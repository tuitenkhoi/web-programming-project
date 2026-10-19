"use strict";

document.addEventListener("DOMContentLoaded", function () {
  const detailContent = document.querySelector("#product-detail-content");
  const notFound = document.querySelector("#product-not-found");
  const form = document.querySelector("#product-option-form");
  const productImage = document.querySelector("#product-main-image");
  const thumbnails = document.querySelector("#product-thumbnails");
  const productBadge = document.querySelector("#product-badge");
  const productName = document.querySelector("#product-name");
  const breadcrumbName = document.querySelector("#breadcrumb-product-name");
  const productCategory = document.querySelector("#product-category");
  const productPrice = document.querySelector("#product-price");
  const productOldPrice = document.querySelector("#product-old-price");
  const productDescription = document.querySelector("#product-description");
  const quantityInput = document.querySelector("#product-quantity");
  const decreaseButton = document.querySelector("#decrease-product-quantity");
  const increaseButton = document.querySelector("#increase-product-quantity");
  const totalPrice = document.querySelector("#product-total-price");
  const noteInput = document.querySelector("#product-note");
  const noteCount = document.querySelector("#product-note-count");
  const relatedList = document.querySelector("#related-product-list");
  const cartToast = document.querySelector("#cart-toast");

  if (!form || !window.MocCoffeeApi) return;

  const productId = new URLSearchParams(window.location.search).get("id");
  let currentProduct = null;

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatCurrency(value) {
    return window.MocCoffee?.formatCurrency
      ? window.MocCoffee.formatCurrency(value)
      : new Intl.NumberFormat("vi-VN", {
          style: "currency",
          currency: "VND",
          maximumFractionDigits: 0,
        }).format(Number(value) || 0);
  }

  function getQuantity() {
    const value = Number(quantityInput?.value || 1);
    return Math.min(99, Math.max(1, Number.isInteger(value) ? value : 1));
  }

  function getSelectedSize() {
    const selected = document.querySelector(
      'input[name="productSize"]:checked'
    );

    return {
      name: selected?.value || "M",
      extraPrice: Number(selected?.dataset.extraPrice || 0),
    };
  }

  function getSelectedToppings() {
    return Array.from(
      document.querySelectorAll(".topping-checkbox:checked")
    ).map(function (topping) {
      return {
        name: topping.value,
        price: Number(topping.dataset.price || 0),
      };
    });
  }

  function calculateUnitPrice() {
    if (!currentProduct) return 0;

    const toppingPrice = getSelectedToppings().reduce(
      (total, topping) => total + topping.price,
      0
    );

    return Math.max(
      0,
      currentProduct.price +
        getSelectedSize().extraPrice +
        toppingPrice
    );
  }

  function updatePrice() {
    const unitPrice = calculateUnitPrice();
    const quantity = getQuantity();

    if (quantityInput) quantityInput.value = quantity;
    if (productPrice) productPrice.textContent = formatCurrency(unitPrice);
    if (totalPrice) totalPrice.textContent = formatCurrency(unitPrice * quantity);
  }

  function showToast(message) {
    const body = cartToast?.querySelector(".toast-body");
    if (body) body.textContent = message;
    if (cartToast && typeof bootstrap !== "undefined") {
      bootstrap.Toast.getOrCreateInstance(cartToast).show();
    }
  }

  function renderProduct() {
    document.title = `${currentProduct.name} | Mộc Coffee`;
    productName.textContent = currentProduct.name;
    breadcrumbName.textContent = currentProduct.name;
    productCategory.textContent = currentProduct.categoryName;
    productDescription.textContent =
      currentProduct.description || "Món ngon tại Mộc Coffee.";
    productImage.src = currentProduct.image;
    productImage.alt = currentProduct.name;
    productOldPrice?.classList.add("d-none");
    productBadge?.classList.add("d-none");

    if (thumbnails) {
      thumbnails.innerHTML = `
        <button type="button" class="product-thumbnail active" data-image="${escapeHTML(currentProduct.image)}">
          <img src="${escapeHTML(currentProduct.image)}" alt="${escapeHTML(currentProduct.name)}" />
        </button>`;
    }

    updatePrice();
  }

  function renderRelated(rawProducts) {
    if (!relatedList) return;

    const products = rawProducts
      .map((product) =>
        window.MocCoffeeApi.normalizeProduct(product, true)
      )
      .filter((product) => product.id !== currentProduct.id)
      .sort(function (first, second) {
        const firstSame = first.categoryId === currentProduct.categoryId ? 0 : 1;
        const secondSame = second.categoryId === currentProduct.categoryId ? 0 : 1;
        return firstSame - secondSame;
      })
      .slice(0, 4);

    relatedList.innerHTML = products.map(function (product) {
      return `
        <div class="col-12 col-sm-6 col-lg-3">
          <article class="card product-card h-100">
            <img src="${escapeHTML(product.image)}" class="card-img-top" alt="${escapeHTML(product.name)}" data-related-image />
            <div class="card-body d-flex flex-column">
              <p class="small text-secondary mb-1">${escapeHTML(product.categoryName)}</p>
              <h3 class="h5">${escapeHTML(product.name)}</h3>
              <p class="text-secondary">${escapeHTML(product.description || "Món ngon tại Mộc Coffee.")}</p>
              <div class="d-flex justify-content-between align-items-center mt-auto">
                <strong class="text-danger">${formatCurrency(product.price)}</strong>
                <a href="product-detail.html?id=${product.id}" class="btn btn-sm btn-coffee">Xem món</a>
              </div>
            </div>
          </article>
        </div>`;
    }).join("");
  }

  function showUnavailable(message) {
    detailContent?.classList.add("d-none");
    notFound?.classList.remove("d-none");
    const paragraph = notFound?.querySelector("p");
    if (paragraph && message) paragraph.textContent = message;
  }

  function addToCart() {
    if (!currentProduct || !window.MocCoffee?.addToCart) return;

    const item = window.MocCoffee.addToCart({
      id: currentProduct.id,
      name: currentProduct.name,
      image: currentProduct.image,
      price: calculateUnitPrice(),
      quantity: getQuantity(),
      size: getSelectedSize().name,
      sugar: document.querySelector("#sugar-level")?.value || "70%",
      ice: document.querySelector("#ice-level")?.value || "70%",
      toppings: getSelectedToppings(),
      note: noteInput?.value.trim() || "",
    });

    showToast(`Đã thêm "${item.name}" vào giỏ hàng.`);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    addToCart();
  });

  decreaseButton?.addEventListener("click", function () {
    quantityInput.value = Math.max(1, getQuantity() - 1);
    updatePrice();
  });

  increaseButton?.addEventListener("click", function () {
    quantityInput.value = Math.min(99, getQuantity() + 1);
    updatePrice();
  });

  quantityInput?.addEventListener("change", updatePrice);
  document.querySelectorAll(
    'input[name="productSize"], .topping-checkbox'
  ).forEach((input) => input.addEventListener("change", updatePrice));

  noteInput?.addEventListener("input", function () {
    if (noteCount) noteCount.textContent = this.value.length;
  });

  thumbnails?.addEventListener("click", function (event) {
    const button = event.target.closest(".product-thumbnail");
    if (!button) return;
    productImage.src = button.dataset.image;
    thumbnails.querySelectorAll(".product-thumbnail")
      .forEach((item) => item.classList.toggle("active", item === button));
  });

  productImage?.addEventListener("error", function () {
    this.src = "../assets/images/products/default-product.jpg";
  }, { once: true });

  relatedList?.addEventListener("error", function (event) {
    if (event.target.matches("[data-related-image]")) {
      event.target.src = "../assets/images/products/default-product.jpg";
    }
  }, true);

  async function initialize() {
    if (!productId || !/^\d+$/.test(productId)) {
      showUnavailable("ID sản phẩm không hợp lệ.");
      return;
    }

    try {
      const [rawProduct, rawProducts] = await Promise.all([
        window.MocCoffeeApi.getProductById(productId),
        window.MocCoffeeApi.getProducts(),
      ]);

      currentProduct = window.MocCoffeeApi.normalizeProduct(
        rawProduct,
        true
      );
      renderProduct();
      renderRelated(rawProducts);
    } catch (error) {
      showUnavailable(error.message);
    }
  }

  initialize();
});
