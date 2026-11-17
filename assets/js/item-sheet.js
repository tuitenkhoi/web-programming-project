/* Thẻ tùy chỉnh món: bấm "thêm vào giỏ" thì hiện thẻ để chọn size, đường, đá, topping, số lượng, ghi chú.
   Điện thoại: trượt từ đáy lên; máy tính: hộp thoại ở giữa.
   Dùng:  MocItemSheet.open(product, { onAdded(item) })
   product = kết quả MocCoffeeApi.normalizeProduct (id, name, price, image, categoryId, categoryName).
   Topping lấy từ máy chủ và chỉ hiện topping áp dụng cho món này (MocCartOptions.toppingsFor). */
(function () {
  "use strict";

  var SIZES = [
    { code: "S", note: "-5.000đ" },
    { code: "M", note: "Chuẩn" },
    { code: "L", note: "+10.000đ" },
  ];
  var LEVELS = ["0%", "30%", "50%", "70%", "100%"];
  var LEVEL_TEXT = { "0%": "Không", "30%": "30%", "50%": "50%", "70%": "70%", "100%": "100%" };

  var Options = window.MocCartOptions;
  var toppingsPromise = null;
  var root = null;
  var state = null;
  var lastFocus = null;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function money(value) {
    return new Intl.NumberFormat("vi-VN").format(Math.max(0, Number(value) || 0)) + "đ";
  }

  function loadToppings() {
    if (!toppingsPromise) {
      toppingsPromise = window.MocCoffeeApi.getToppings().catch(function (error) {
        toppingsPromise = null;
        throw error;
      });
    }
    return toppingsPromise;
  }

  // Bánh ngọt không có size / đường / đá
  function isDrink(product) {
    return !/bánh/i.test(String(product.categoryName || ""));
  }

  function chips(name, items, selected, onPick, render) {
    var group = el("div", "isheet-chips");
    group.setAttribute("role", "radiogroup");
    items.forEach(function (item) {
      var value = typeof item === "string" ? item : item.code;
      var btn = el("button", "isheet-chip");
      btn.type = "button";
      btn.setAttribute("role", "radio");
      btn.dataset.value = value;
      btn.setAttribute("aria-checked", value === selected ? "true" : "false");
      if (value === selected) btn.classList.add("is-on");
      render(btn, item);
      btn.addEventListener("click", function () {
        Array.prototype.forEach.call(group.children, function (b) {
          var on = b === btn;
          b.classList.toggle("is-on", on);
          b.setAttribute("aria-checked", on ? "true" : "false");
        });
        onPick(value);
      });
      group.appendChild(btn);
    });
    return group;
  }

  function section(title) {
    var box = el("section", "isheet-section");
    box.appendChild(el("h3", "isheet-title", title));
    return box;
  }

  function unitPrice() {
    var picked = state.toppings.filter(function (t) { return state.chosen.has(t.name); });
    return Options.calcUnitPrice(state.product.price, state.size, picked);
  }

  function refreshPrice() {
    var total = unitPrice() * state.quantity;
    state.priceEl.textContent = money(total);
    state.qtyEl.textContent = state.quantity;
    state.minus.disabled = state.quantity <= 1;
  }

  function close() {
    if (!root) return;
    root.classList.remove("is-open");
    document.body.classList.remove("isheet-lock");
    document.removeEventListener("keydown", onKey, true);
    var node = root;
    root = null;
    window.setTimeout(function () { node.remove(); }, 220);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function onKey(event) {
    if (event.key === "Escape") { event.stopPropagation(); close(); return; }
    if (event.key !== "Tab" || !root) return;
    var items = root.querySelectorAll("button:not([disabled]), input, [tabindex='0']");
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function renderToppings(box, toppings) {
    box.textContent = "";
    if (!toppings.length) {
      box.appendChild(el("p", "isheet-muted", "Món này không có topping."));
      return;
    }
    toppings.forEach(function (topping) {
      var row = el("label", "isheet-topping");
      var input = el("input");
      input.type = "checkbox";
      input.value = topping.name;
      input.checked = state.chosen.has(topping.name);
      input.addEventListener("change", function () {
        if (input.checked) state.chosen.add(topping.name); else state.chosen.delete(topping.name);
        row.classList.toggle("is-on", input.checked);
        refreshPrice();
      });
      row.classList.toggle("is-on", input.checked);
      row.append(input, el("span", "isheet-topping-name", topping.name), el("strong", "", "+" + money(topping.price)));
      box.appendChild(row);
    });
  }

  function open(product, options) {
    if (!product || !Options || !window.MocCoffeeApi) return;
    if (root) close();
    options = options || {};
    lastFocus = document.activeElement;

    state = {
      product: product,
      size: "M",
      sugar: "70%",
      ice: "70%",
      quantity: 1,
      toppings: [],
      chosen: new Set(),
      drink: isDrink(product),
    };

    root = el("div", "isheet");
    var backdrop = el("div", "isheet-backdrop");
    backdrop.addEventListener("click", close);
    var panel = el("div", "isheet-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Tùy chỉnh " + product.name);

    panel.appendChild(el("div", "isheet-grip"));

    // Đầu thẻ: ảnh nhỏ + tên + giá + nút đóng
    var head = el("header", "isheet-head");
    var img = el("img", "isheet-img");
    img.alt = "";
    img.src = product.image;
    img.addEventListener("error", function () { img.src = (/\/pages\//.test(location.pathname) ? "../" : "") + "assets/images/products/default-product.jpg"; }, { once: true });
    var info = el("div", "isheet-info");
    info.append(el("h2", "isheet-name", product.name), el("p", "isheet-base", money(product.price)));
    var closeBtn = el("button", "isheet-close");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Đóng");
    closeBtn.appendChild(el("i", "bi bi-x-lg"));
    closeBtn.addEventListener("click", close);
    head.append(img, info, closeBtn);
    panel.appendChild(head);

    var body = el("div", "isheet-body");

    if (state.drink) {
      var sizeBox = section("Kích cỡ");
      sizeBox.appendChild(chips("size", SIZES, state.size, function (v) { state.size = v; refreshPrice(); }, function (btn, item) {
        btn.append(el("strong", "", item.code), el("small", "", item.note));
      }));
      body.appendChild(sizeBox);

      var sugarBox = section("Mức đường");
      sugarBox.appendChild(chips("sugar", LEVELS, state.sugar, function (v) { state.sugar = v; }, function (btn, item) {
        btn.textContent = LEVEL_TEXT[item];
      }));
      body.appendChild(sugarBox);

      var iceBox = section("Mức đá");
      iceBox.appendChild(chips("ice", LEVELS, state.ice, function (v) { state.ice = v; }, function (btn, item) {
        btn.textContent = LEVEL_TEXT[item];
      }));
      body.appendChild(iceBox);

      var toppingBox = section("Topping");
      var toppingList = el("div", "isheet-toppings");
      toppingList.appendChild(el("p", "isheet-muted", "Đang tải topping..."));
      toppingBox.appendChild(toppingList);
      body.appendChild(toppingBox);

      loadToppings().then(function (all) {
        if (!root) return;
        state.toppings = Options.toppingsFor(all, product.id, product.categoryId);
        renderToppings(toppingList, state.toppings);
        refreshPrice();
      }).catch(function () {
        toppingList.textContent = "";
        toppingList.appendChild(el("p", "isheet-muted", "Không tải được topping. Bạn vẫn có thể thêm món không kèm topping."));
      });
    }

    var noteBox = section("Ghi chú");
    var note = el("input", "isheet-note");
    note.type = "text";
    note.maxLength = 200;
    note.placeholder = "Ví dụ: ít ngọt, không dùng ống hút";
    note.setAttribute("aria-label", "Ghi chú cho món");
    noteBox.appendChild(note);
    body.appendChild(noteBox);
    panel.appendChild(body);

    // Chân thẻ: số lượng + nút thêm (luôn thấy khi cuộn)
    var foot = el("footer", "isheet-foot");
    var stepper = el("div", "isheet-stepper");
    var minus = el("button", "isheet-step");
    minus.type = "button";
    minus.setAttribute("aria-label", "Giảm số lượng");
    minus.appendChild(el("i", "bi bi-dash-lg"));
    var qtyEl = el("span", "isheet-qty", "1");
    qtyEl.setAttribute("aria-live", "polite");
    var plus = el("button", "isheet-step");
    plus.type = "button";
    plus.setAttribute("aria-label", "Tăng số lượng");
    plus.appendChild(el("i", "bi bi-plus-lg"));
    minus.addEventListener("click", function () { state.quantity = Math.max(1, state.quantity - 1); refreshPrice(); });
    plus.addEventListener("click", function () { state.quantity = Math.min(99, state.quantity + 1); refreshPrice(); });
    stepper.append(minus, qtyEl, plus);

    var add = el("button", "isheet-add");
    add.type = "button";
    var priceEl = el("span", "isheet-add-price", money(product.price));
    add.append(el("span", "", "Thêm vào giỏ"), priceEl);
    foot.append(stepper, add);
    panel.appendChild(foot);

    state.priceEl = priceEl;
    state.qtyEl = qtyEl;
    state.minus = minus;

    add.addEventListener("click", function () {
      var picked = state.toppings.filter(function (t) { return state.chosen.has(t.name); })
        .map(function (t) { return { name: t.name, price: Number(t.price) }; });
      var item = {
        id: product.id,
        name: product.name,
        image: product.image,
        price: Options.calcUnitPrice(product.price, state.size, picked),
        basePrice: product.price,
        quantity: state.quantity,
        size: state.size,
        sugar: state.sugar,
        ice: state.ice,
        toppings: picked,
        note: note.value.trim(),
      };
      var saved = window.MocCoffee && window.MocCoffee.addToCart ? window.MocCoffee.addToCart(item) : item;
      close();
      if (typeof options.onAdded === "function") options.onAdded(saved || item);
    });

    root.append(backdrop, panel);
    document.body.appendChild(root);
    document.body.classList.add("isheet-lock");
    document.addEventListener("keydown", onKey, true);
    refreshPrice();
    window.requestAnimationFrame(function () {
      if (root) root.classList.add("is-open");
      add.focus({ preventScroll: true });
    });
  }

  window.MocItemSheet = { open: open, close: close };
})();
