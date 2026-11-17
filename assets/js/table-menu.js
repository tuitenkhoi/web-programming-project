/* Giao diện đặt món khi khách quét mã QR tại bàn (menu.html?table=... hoặc đã nhớ bàn trong 6 giờ).
   Bật class "table-mode" trên <body> để table-menu.css thu gọn trang: header nhỏ, thanh danh mục cuộn ngang,
   danh sách món gọn; JS này thêm header (bàn + đăng nhập tùy chọn + giỏ) và giỏ hàng ghim ở đáy.
   Khách không cần đăng nhập; nếu đăng nhập thì đơn được lưu vào lịch sử tài khoản. */
(function () {
  "use strict";

  var CART_KEY = "mocCoffeeCart";
  var body = document.body;
  var params = new URLSearchParams(location.search);
  var hasTableParam = /^[A-Za-z0-9-]{1,20}$/.test((params.get("table") || "").trim());

  function currentTable() {
    return window.MocTable && window.MocTable.get ? window.MocTable.get() : null;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function money(v) { return new Intl.NumberFormat("vi-VN").format(Math.max(0, Number(v) || 0)) + "đ"; }
  function readCart() {
    try { var c = JSON.parse(localStorage.getItem(CART_KEY) || "[]"); return Array.isArray(c) ? c : []; }
    catch (e) { return []; }
  }
  function customer() {
    try { return window.MocCoffeeApi && window.MocCoffeeApi.getCustomerProfile ? window.MocCoffeeApi.getCustomerProfile() : null; }
    catch (e) { return null; }
  }

  var header, tableLabel, accountLink, cartCount;
  var bar, sheet;

  function buildHeader() {
    header = el("header", "tm-header");
    var brand = el("a", "tm-brand");
    brand.href = "../index.html";
    brand.append(el("i", "bi bi-cup-hot-fill"), el("span", "", "Mộc Coffee"));

    tableLabel = el("span", "tm-table");
    tableLabel.setAttribute("role", "status");

    accountLink = el("a", "tm-account");
    accountLink.href = "./account.html";

    var cartLink = el("a", "tm-cartlink");
    cartLink.href = "./cart.html";
    cartLink.setAttribute("aria-label", "Giỏ hàng");
    cartLink.appendChild(el("i", "bi bi-bag"));
    cartCount = el("span", "tm-badge", "0");
    cartLink.appendChild(cartCount);

    var right = el("div", "tm-right");
    right.append(accountLink, cartLink);
    header.append(brand, tableLabel, right);
    body.insertBefore(header, body.firstChild);
    refreshHeader();
  }

  function refreshHeader() {
    var t = currentTable();
    tableLabel.textContent = t ? (t.name || "Bàn " + t.code) : "";
    tableLabel.hidden = !t;
    var who = customer();
    accountLink.textContent = "";
    if (who && (who.full_name || who.name || who.email)) {
      accountLink.append(el("i", "bi bi-person-check-fill"), el("span", "", String(who.full_name || who.name || "Tài khoản").split(" ").pop()));
      accountLink.title = "Đơn của bạn sẽ được lưu vào tài khoản";
    } else {
      accountLink.append(el("i", "bi bi-person"), el("span", "", "Đăng nhập"));
      accountLink.title = "Không bắt buộc – đăng nhập để lưu lịch sử đơn";
    }
  }

  /* ---------- Giỏ ghim + bảng giỏ hàng ---------- */
  function buildBar() {
    bar = el("button", "tm-bar");
    bar.type = "button";
    bar.setAttribute("aria-haspopup", "dialog");
    bar.append(
      el("span", "tm-bar-count", "0"),
      el("span", "tm-bar-text", "Xem giỏ hàng"),
      el("strong", "tm-bar-total", "0đ")
    );
    bar.addEventListener("click", openSheet);
    body.appendChild(bar);
  }

  function totals(cart) {
    var qty = 0, sum = 0;
    cart.forEach(function (i) {
      var q = Math.max(1, Number(i.quantity) || 1);
      qty += q;
      sum += q * (Number(i.price) || 0);
    });
    return { qty: qty, sum: sum };
  }

  function refreshBar() {
    var cart = readCart();
    var t = totals(cart);
    cartCount.textContent = t.qty;
    cartCount.hidden = t.qty === 0;
    bar.querySelector(".tm-bar-count").textContent = t.qty;
    bar.querySelector(".tm-bar-total").textContent = money(t.sum);
    bar.classList.toggle("is-show", t.qty > 0);
    body.classList.toggle("tm-has-bar", t.qty > 0);
    if (sheet) {
      if (!t.qty) closeSheet(); else renderSheet();
    }
  }

  function optionText(i) {
    var parts = [];
    if (i.size) parts.push("Size " + i.size);
    if (i.sugar) parts.push("Đường " + i.sugar);
    if (i.ice) parts.push("Đá " + i.ice);
    var tops = (Array.isArray(i.toppings) ? i.toppings : []).map(function (x) { return typeof x === "string" ? x : x.name; });
    if (tops.length) parts.push("+ " + tops.join(", "));
    if (i.note) parts.push("“" + i.note + "”");
    return parts.join(" · ");
  }

  function changeQty(index, delta) {
    var cart = readCart();
    var item = cart[index];
    if (!item) return;
    var q = (Number(item.quantity) || 1) + delta;
    if (q <= 0) cart.splice(index, 1); else item.quantity = Math.min(99, q);
    window.MocCoffee.saveCart(cart);
  }

  function renderSheet() {
    var list = sheet.querySelector(".tm-sheet-list");
    var cart = readCart();
    list.textContent = "";
    cart.forEach(function (item, index) {
      var row = el("div", "tm-line");
      var info = el("div", "tm-line-info");
      info.appendChild(el("strong", "", item.name));
      var opt = optionText(item);
      if (opt) info.appendChild(el("small", "", opt));
      info.appendChild(el("span", "tm-line-price", money((Number(item.price) || 0) * (Number(item.quantity) || 1))));

      var step = el("div", "tm-step");
      var minus = el("button", "", "");
      minus.type = "button";
      minus.setAttribute("aria-label", "Giảm " + item.name);
      minus.appendChild(el("i", "bi " + ((Number(item.quantity) || 1) <= 1 ? "bi-trash3" : "bi-dash-lg")));
      minus.addEventListener("click", function () { changeQty(index, -1); });
      var plus = el("button", "", "");
      plus.type = "button";
      plus.setAttribute("aria-label", "Tăng " + item.name);
      plus.appendChild(el("i", "bi bi-plus-lg"));
      plus.addEventListener("click", function () { changeQty(index, 1); });
      step.append(minus, el("span", "", String(Number(item.quantity) || 1)), plus);
      row.append(info, step);
      list.appendChild(row);
    });
    var t = totals(cart);
    sheet.querySelector(".tm-sheet-sum").textContent = money(t.sum);
  }

  function openSheet() {
    if (sheet || !readCart().length) return;
    sheet = el("div", "tm-sheet");
    var back = el("div", "tm-sheet-back");
    back.addEventListener("click", closeSheet);
    var panel = el("div", "tm-sheet-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Giỏ hàng");

    var head = el("div", "tm-sheet-head");
    var t = currentTable();
    head.appendChild(el("h2", "", t ? "Giỏ hàng · " + (t.name || "Bàn " + t.code) : "Giỏ hàng"));
    var x = el("button", "tm-sheet-x");
    x.type = "button";
    x.setAttribute("aria-label", "Đóng giỏ hàng");
    x.appendChild(el("i", "bi bi-x-lg"));
    x.addEventListener("click", closeSheet);
    head.appendChild(x);

    var list = el("div", "tm-sheet-list");
    var foot = el("div", "tm-sheet-foot");
    var sum = el("div", "tm-sheet-total");
    sum.append(el("span", "", "Tạm tính"), el("strong", "tm-sheet-sum", "0đ"));
    var note = el("p", "tm-sheet-note", "Phí phục vụ và mã giảm giá được tính ở bước tiếp theo.");
    var go = el("a", "tm-go", "Đặt món & thanh toán");
    go.href = "./cart.html";
    foot.append(sum, note, go);

    panel.append(head, list, foot);
    sheet.append(back, panel);
    body.appendChild(sheet);
    body.classList.add("isheet-lock");
    renderSheet();
    window.requestAnimationFrame(function () { if (sheet) sheet.classList.add("is-open"); go.focus({ preventScroll: true }); });
    document.addEventListener("keydown", onKey, true);
  }

  function closeSheet() {
    if (!sheet) return;
    var node = sheet;
    sheet = null;
    node.classList.remove("is-open");
    body.classList.remove("isheet-lock");
    document.removeEventListener("keydown", onKey, true);
    window.setTimeout(function () { node.remove(); }, 220);
    if (bar) bar.focus({ preventScroll: true });
  }

  function onKey(e) {
    if (e.key === "Escape") closeSheet();
  }

  /* ---------- Bật chế độ tại bàn ---------- */
  function enable() {
    if (body.classList.contains("table-mode")) return;
    body.classList.add("table-mode");
    buildHeader();
    buildBar();
    refreshBar();
    window.addEventListener("mocCoffeeCartUpdated", refreshBar);
    window.addEventListener("storage", function (e) { if (e.key === CART_KEY) refreshBar(); });

    // Món hiện dạng danh sách gọn (menu.js vẽ danh sách khi chọn kiểu "list")
    var listBtn = document.querySelector("#view-list");
    if (listBtn && listBtn.getAttribute("aria-pressed") !== "true") listBtn.click();
  }

  function disable() {
    body.classList.remove("table-mode", "tm-has-bar");
    [header, bar, sheet].forEach(function (n) { if (n) n.remove(); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    // table-context.js ghi nhớ bàn bất đồng bộ khi mở bằng ?table=, nên chờ rồi kiểm tra lại
    if (currentTable() || hasTableParam) enable();
    if (hasTableParam) {
      var tries = 0;
      var timer = window.setInterval(function () {
        tries += 1;
        if (header) refreshHeader();
        if (currentTable() || tries > 20) {
          window.clearInterval(timer);
          if (!currentTable()) disable(); // mã bàn không hợp lệ / bảo trì → về giao diện thường
        }
      }, 300);
    }
    // bấm "Không phải bàn này?" xoá bàn → thoát chế độ tại bàn
    document.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("#moc-table-banner button")) window.setTimeout(function () { if (!currentTable()) disable(); }, 0);
    });
  });
})();
