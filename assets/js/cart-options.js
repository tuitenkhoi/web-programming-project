/* Tính giá và sửa tùy chọn (size, topping) của món trong giỏ hàng.
   File này KHÔNG đụng tới giao diện nên kiểm thử được bằng Node (xem tests/cart-options.test.js).
   Trình duyệt: window.MocCartOptions.   Node: require('.../cart-options.js').

   Một món trong giỏ có dạng:
     { id, name, price, basePrice, quantity, size, sugar, ice, toppings: [{ name, price }], note, cartKey }
   Trong đó price (đơn giá) = basePrice (giá món) + phụ thu size + tổng giá các topping.
   Giỏ cũ chưa lưu basePrice thì suy ngược ra từ price. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MocCartOptions = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  // Phụ thu theo size. PHẢI khớp SIZE_PRICES ở backend/src/controllers/order.controller.js
  var SIZE_EXTRA = { S: -5000, M: 0, L: 10000 };
  var MAX_QUANTITY = 99;

  function toppingName(topping) {
    return typeof topping === "string" ? topping : (topping && topping.name) || "";
  }

  function sizeExtra(size) {
    return SIZE_EXTRA[size] || 0;
  }

  // Chuẩn hóa topping của món thành [{ name, price }].
  // Topping cũ dạng chữ (không có giá) thì tra giá trong priceMap (Map tên -> giá), không có thì tính 0.
  function normalizeToppings(toppings, priceMap) {
    return (Array.isArray(toppings) ? toppings : [])
      .map(function (topping) {
        var name = toppingName(topping);
        var price = Number(topping && topping.price);
        if (!Number.isFinite(price)) price = priceMap && priceMap.has(name) ? priceMap.get(name) : 0;
        return { name: name, price: price };
      })
      .filter(function (topping) { return topping.name; });
  }

  function sumPrices(toppings) {
    return toppings.reduce(function (total, topping) { return total + topping.price; }, 0);
  }

  // Giá gốc của món (chưa cộng size / topping)
  function getBasePrice(item, priceMap) {
    var stored = Number(item.basePrice);
    if (item.basePrice !== undefined && item.basePrice !== null && Number.isFinite(stored)) return stored;
    var extras = sizeExtra(item.size) + sumPrices(normalizeToppings(item.toppings, priceMap));
    return Math.max(0, Number(item.price) - extras);
  }

  // Đơn giá = giá gốc + phụ thu size + giá các topping (không âm)
  function calcUnitPrice(basePrice, size, toppings) {
    return Math.max(0, Number(basePrice) + sizeExtra(size) + sumPrices(toppings));
  }

  // Khóa để nhận biết hai dòng giỏ hàng là "cùng một món" (cùng size, đường, đá, topping, ghi chú)
  function makeCartKey(item) {
    var names = (item.toppings || []).map(toppingName).sort().join("-");
    return [item.id, item.size || "M", item.sugar || "70%", item.ice || "70%", names, item.note || ""].join("|");
  }

  // Sau khi đổi tùy chọn, hai dòng có thể trở thành cùng một món: gộp số lượng lại (tối đa 99)
  function mergeSameItems(cart) {
    var result = [];
    cart.forEach(function (item) {
      var same = result.find(function (other) { return other.cartKey === item.cartKey; });
      if (same) same.quantity = Math.min(MAX_QUANTITY, same.quantity + item.quantity);
      else result.push(item);
    });
    return result;
  }

  // Đổi size / topping của MỘT dòng trong giỏ.
  // options: { size, toppings: [{ name, price }], basePrice (không bắt buộc: giá gốc mới nhất) }
  // Trả về { cart: giỏ mới, item: dòng sau khi sửa (có thể đã gộp vào dòng khác) }
  function applyOptions(cart, cartKey, options) {
    var index = cart.findIndex(function (item) { return item.cartKey === cartKey; });
    if (index === -1) return { cart: cart, item: null };

    var current = cart[index];
    var size = SIZE_EXTRA.hasOwnProperty(options.size) ? options.size : current.size;
    var toppings = normalizeToppings(options.toppings);
    var basePrice = options.basePrice !== undefined && Number.isFinite(Number(options.basePrice))
      ? Number(options.basePrice)
      : getBasePrice(current);

    var updated = Object.assign({}, current, {
      size: size,
      toppings: toppings,
      basePrice: basePrice,
      price: calcUnitPrice(basePrice, size, toppings),
      options: "" // chữ mô tả tùy chọn lưu sẵn (nếu có) đã cũ, để giao diện tự dựng lại
    });
    updated.cartKey = makeCartKey(updated);

    var next = cart.slice();
    next[index] = updated;
    next = mergeSameItems(next);

    return {
      cart: next,
      item: next.find(function (item) { return item.cartKey === updated.cartKey; })
    };
  }

  // Đồng bộ giỏ với danh sách topping ĐANG BÁN (activeToppings: [{ name, price }]):
  //  - topping đã ngừng bán / bị xóa thì bỏ khỏi món (nếu không, server sẽ từ chối đơn)
  //  - giá topping đổi thì tính lại đơn giá
  // Trả về { cart, removed: [tên topping bị bỏ], priceChanged: có món đổi đơn giá không, changed: có sửa gì không }
  function reconcile(cart, activeToppings) {
    var priceMap = new Map(activeToppings.map(function (topping) { return [topping.name, Number(topping.price)]; }));
    var removed = [];
    var changed = false;
    var priceChanged = false;

    var next = cart.map(function (item) {
      var oldToppings = normalizeToppings(item.toppings);
      var basePrice = getBasePrice(item);
      var kept = oldToppings
        .filter(function (topping) {
          if (priceMap.has(topping.name)) return true;
          if (removed.indexOf(topping.name) === -1) removed.push(topping.name);
          return false;
        })
        .map(function (topping) { return { name: topping.name, price: priceMap.get(topping.name) }; });

      var price = calcUnitPrice(basePrice, item.size, kept);
      var sameToppings = JSON.stringify(oldToppings) === JSON.stringify(kept);
      if (sameToppings && price === Number(item.price) && item.basePrice === basePrice) return item;

      changed = true;
      if (price !== Number(item.price)) priceChanged = true;
      var updated = Object.assign({}, item, { toppings: kept, basePrice: basePrice, price: price });
      if (!sameToppings) updated.options = "";
      updated.cartKey = makeCartKey(updated);
      return updated;
    });

    return { cart: changed ? mergeSameItems(next) : cart, removed: removed, priceChanged: priceChanged, changed: changed };
  }

  // Topping có áp dụng cho món này không. PHẢI khớp toppingAppliesTo ở backend/src/services/toppings.js.
  // topping.scope = { categories: [id], include: [productId], exclude: [productId] }; không có scope = mọi món.
  function appliesTo(topping, productId, categoryId) {
    var scope = topping && topping.scope;
    if (!scope) return true;
    var categories = scope.categories || [];
    var include = scope.include || [];
    var exclude = scope.exclude || [];
    if (exclude.indexOf(Number(productId)) !== -1) return false;
    if (!categories.length && !include.length) return true;
    return include.indexOf(Number(productId)) !== -1 || categories.indexOf(Number(categoryId)) !== -1;
  }

  function toppingsFor(toppings, productId, categoryId) {
    return (toppings || []).filter(function (topping) { return appliesTo(topping, productId, categoryId); });
  }

  return {
    appliesTo: appliesTo,
    toppingsFor: toppingsFor,
    SIZE_EXTRA: SIZE_EXTRA,
    toppingName: toppingName,
    normalizeToppings: normalizeToppings,
    getBasePrice: getBasePrice,
    calcUnitPrice: calcUnitPrice,
    makeCartKey: makeCartKey,
    applyOptions: applyOptions,
    reconcile: reconcile
  };
});
