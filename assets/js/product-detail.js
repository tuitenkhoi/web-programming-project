document.addEventListener("DOMContentLoaded", function () {
    /*
     * Danh sách dữ liệu sản phẩm mẫu.
     * Sau này có PHP/MySQL, phần này sẽ được thay bằng dữ liệu từ database.
     */
    const products = [
        {
            id: 1,
            slug: "ca-phe-sua-da",
            name: "Cà phê sữa đá",
            category: "Cà phê",
            price: 29000,
            oldPrice: 35000,
            image: "../assets/images/products/ca-phe-sua-da.jpg",
            description:
                "Cà phê sữa đá truyền thống với hương vị đậm đà, kết hợp giữa cà phê rang xay và sữa đặc.",
            rating: 4.9,
            sold: 125
        },
        {
            id: 2,
            slug: "bac-xiu",
            name: "Bạc xỉu",
            category: "Cà phê",
            price: 32000,
            oldPrice: 38000,
            image: "../assets/images/products/bac-xiu.jpg",
            description:
                "Bạc xỉu thơm béo với lượng sữa nhiều hơn cà phê, phù hợp với khách hàng yêu thích vị nhẹ.",
            rating: 4.8,
            sold: 98
        },
        {
            id: 3,
            slug: "ca-phe-den-da",
            name: "Cà phê đen đá",
            category: "Cà phê",
            price: 25000,
            oldPrice: 30000,
            image: "../assets/images/products/ca-phe-den-da.jpg",
            description:
                "Cà phê đen đá mang hương vị mạnh mẽ, đậm đà và giúp bạn tỉnh táo cho một ngày năng động.",
            rating: 4.7,
            sold: 87
        },
        {
            id: 4,
            slug: "tra-dao-cam-sa",
            name: "Trà đào cam sả",
            category: "Trà trái cây",
            price: 45000,
            oldPrice: 52000,
            image: "../assets/images/products/tra-dao-cam-sa.jpg",
            description:
                "Trà đào cam sả thanh mát với đào miếng, cam tươi và hương sả tự nhiên.",
            rating: 4.9,
            sold: 145
        },
        {
            id: 5,
            slug: "tra-vai",
            name: "Trà vải",
            category: "Trà trái cây",
            price: 42000,
            oldPrice: 48000,
            image: "../assets/images/products/tra-vai.jpg",
            description:
                "Trà vải có vị chua ngọt nhẹ nhàng, kết hợp với những quả vải thơm ngon.",
            rating: 4.8,
            sold: 110
        },
        {
            id: 6,
            slug: "tra-dau",
            name: "Trà dâu",
            category: "Trà trái cây",
            price: 42000,
            oldPrice: 48000,
            image: "../assets/images/products/tra-dau.jpg",
            description:
                "Trà dâu tươi mát, có vị chua ngọt hài hòa và màu sắc hấp dẫn.",
            rating: 4.7,
            sold: 90
        },
        {
            id: 7,
            slug: "matcha-da-xay",
            name: "Matcha đá xay",
            category: "Đá xay",
            price: 49000,
            oldPrice: 55000,
            image: "../assets/images/products/matcha-da-xay.jpg",
            description:
                "Matcha đá xay thơm vị trà xanh, kết hợp cùng sữa và kem béo.",
            rating: 4.9,
            sold: 132
        },
        {
            id: 8,
            slug: "chocolate-da-xay",
            name: "Chocolate đá xay",
            category: "Đá xay",
            price: 49000,
            oldPrice: 55000,
            image: "../assets/images/products/chocolate-da-xay.jpg",
            description:
                "Chocolate đá xay đậm vị ca cao, mát lạnh và được phủ một lớp kem béo.",
            rating: 4.8,
            sold: 105
        },
        {
            id: 9,
            slug: "cookies-da-xay",
            name: "Cookies đá xay",
            category: "Đá xay",
            price: 52000,
            oldPrice: 59000,
            image: "../assets/images/products/cookies-da-xay.jpg",
            description:
                "Cookies đá xay kết hợp bánh quy giòn, sữa và kem tạo nên hương vị thơm béo.",
            rating: 4.8,
            sold: 96
        },
        {
            id: 10,
            slug: "banh-tiramisu",
            name: "Bánh Tiramisu",
            category: "Bánh ngọt",
            price: 45000,
            oldPrice: 50000,
            image: "../assets/images/products/banh-tiramisu.jpg",
            description:
                "Bánh Tiramisu mềm mịn, thơm hương cà phê và có vị kem béo nhẹ nhàng.",
            rating: 4.9,
            sold: 78
        },
        {
            id: 11,
            slug: "banh-croissant",
            name: "Bánh Croissant",
            category: "Bánh ngọt",
            price: 35000,
            oldPrice: 40000,
            image: "../assets/images/products/banh-croissant.jpg",
            description:
                "Bánh sừng bò với lớp vỏ giòn nhẹ, bên trong mềm và thơm vị bơ.",
            rating: 4.7,
            sold: 65
        },
        {
            id: 12,
            slug: "banh-mousse-chocolate",
            name: "Bánh Mousse Chocolate",
            category: "Bánh ngọt",
            price: 48000,
            oldPrice: 55000,
            image: "../assets/images/products/banh-mousse-chocolate.jpg",
            description:
                "Bánh mousse chocolate mềm mịn, ngọt vừa và có hương vị ca cao đậm đà.",
            rating: 4.8,
            sold: 82
        }
    ];

    const CART_KEY = "mocCoffeeCart";

    const productImage = document.getElementById("productImage");
    const productName = document.getElementById("productName");
    const productCategory = document.getElementById("productCategory");
    const productPrice = document.getElementById("productPrice");
    const productOldPrice = document.getElementById("productOldPrice");
    const productDescription =
        document.getElementById("productDescription");
    const productRating = document.getElementById("productRating");
    const productSold = document.getElementById("productSold");

    const quantityInput = document.getElementById("quantity");
    const decreaseButton = document.getElementById("decreaseQuantity");
    const increaseButton = document.getElementById("increaseQuantity");

    const addToCartButton = document.getElementById("addToCartBtn");
    const buyNowButton = document.getElementById("buyNowBtn");
    const productNote = document.getElementById("productNote");
    const relatedProducts = document.getElementById("relatedProducts");

    const urlParameters = new URLSearchParams(window.location.search);

    const productParameter =
        urlParameters.get("id") ||
        urlParameters.get("product") ||
        "1";

    let currentProduct = findProduct(productParameter);
    let quantity = 1;

    initializeProductDetail();

    /**
     * Khởi tạo trang chi tiết.
     */
    function initializeProductDetail() {
        if (!currentProduct) {
            showProductNotFound();
            return;
        }

        renderProductDetail();
        renderRelatedProducts();
        handleQuantity();
        handleOptions();
        handleAddToCart();
        handleBuyNow();
    }

    /**
     * Tìm sản phẩm bằng id hoặc slug.
     */
    function findProduct(value) {
        return products.find(function (product) {
            return (
                String(product.id) === String(value) ||
                product.slug === value
            );
        });
    }

    /**
     * Hiển thị thông tin sản phẩm.
     */
    function renderProductDetail() {
        document.title =
            `${currentProduct.name} | Mộc Coffee`;

        if (productImage) {
            productImage.src = currentProduct.image;
            productImage.alt = currentProduct.name;

            productImage.onerror = function () {
                this.src =
                    "../assets/images/products/default-product.jpg";
            };
        }

        setText(productName, currentProduct.name);
        setText(productCategory, currentProduct.category);
        setText(
            productPrice,
            formatCurrency(currentProduct.price)
        );
        setText(
            productOldPrice,
            formatCurrency(currentProduct.oldPrice)
        );
        setText(
            productDescription,
            currentProduct.description
        );
        setText(
            productRating,
            currentProduct.rating.toFixed(1)
        );
        setText(
            productSold,
            `Đã bán ${currentProduct.sold}`
        );

        updateDisplayedPrice();
    }

    /**
     * Tăng giảm số lượng.
     */
    function handleQuantity() {
        if (quantityInput) {
            quantityInput.value = quantity;

            quantityInput.addEventListener("change", function () {
                let newQuantity = Number(quantityInput.value);

                if (
                    Number.isNaN(newQuantity) ||
                    newQuantity < 1
                ) {
                    newQuantity = 1;
                }

                if (newQuantity > 99) {
                    newQuantity = 99;
                }

                quantity = newQuantity;
                quantityInput.value = quantity;

                updateDisplayedPrice();
            });
        }

        if (decreaseButton) {
            decreaseButton.addEventListener("click", function () {
                if (quantity > 1) {
                    quantity--;

                    if (quantityInput) {
                        quantityInput.value = quantity;
                    }

                    updateDisplayedPrice();
                }
            });
        }

        if (increaseButton) {
            increaseButton.addEventListener("click", function () {
                if (quantity < 99) {
                    quantity++;

                    if (quantityInput) {
                        quantityInput.value = quantity;
                    }

                    updateDisplayedPrice();
                }
            });
        }
    }

    /**
     * Theo dõi lựa chọn size và topping.
     */
    function handleOptions() {
        const sizeOptions = document.querySelectorAll(
            'input[name="productSize"]'
        );

        const toppingOptions = document.querySelectorAll(
            'input[name="productTopping"]'
        );

        sizeOptions.forEach(function (option) {
            option.addEventListener(
                "change",
                updateDisplayedPrice
            );
        });

        toppingOptions.forEach(function (option) {
            option.addEventListener(
                "change",
                updateDisplayedPrice
            );
        });
    }

    /**
     * Lấy size đang chọn.
     */
    function getSelectedSize() {
        const selectedSize = document.querySelector(
            'input[name="productSize"]:checked'
        );

        if (!selectedSize) {
            return {
                name: "M",
                price: 0
            };
        }

        return {
            name: selectedSize.value,
            price:
                Number(selectedSize.dataset.price) || 0
        };
    }

    /**
     * Lấy danh sách topping đã chọn.
     */
    function getSelectedToppings() {
        const selectedToppings = document.querySelectorAll(
            'input[name="productTopping"]:checked'
        );

        return Array.from(selectedToppings).map(
            function (topping) {
                return {
                    name:
                        topping.dataset.name ||
                        topping.value,

                    price:
                        Number(topping.dataset.price) || 0
                };
            }
        );
    }

    /**
     * Tính giá một sản phẩm sau khi chọn size và topping.
     */
    function calculateUnitPrice() {
        const size = getSelectedSize();
        const toppings = getSelectedToppings();

        const toppingPrice = toppings.reduce(
            function (total, topping) {
                return total + topping.price;
            },
            0
        );

        return (
            currentProduct.price +
            size.price +
            toppingPrice
        );
    }

    /**
     * Cập nhật giá trên giao diện.
     */
    function updateDisplayedPrice() {
        const unitPrice = calculateUnitPrice();
        const totalPrice = unitPrice * quantity;

        if (productPrice) {
            productPrice.textContent =
                formatCurrency(totalPrice);
        }
    }

    /**
     * Thêm sản phẩm vào giỏ hàng.
     */
    function handleAddToCart() {
        if (!addToCartButton) {
            return;
        }

        addToCartButton.addEventListener("click", function () {
            addCurrentProductToCart();
        });
    }

    /**
     * Mua ngay và chuyển đến trang giỏ hàng.
     */
    function handleBuyNow() {
        if (!buyNowButton) {
            return;
        }

        buyNowButton.addEventListener("click", function () {
            addCurrentProductToCart(false);

            window.location.href = "cart.html";
        });
    }

    function addCurrentProductToCart(showNotification = true) {
        const selectedSize = getSelectedSize();
        const selectedToppings = getSelectedToppings();
        const unitPrice = calculateUnitPrice();

        const cartItem = {
            id: currentProduct.id,
            slug: currentProduct.slug,
            name: currentProduct.name,
            category: currentProduct.category,
            image: currentProduct.image,
            basePrice: currentProduct.price,
            price: unitPrice,
            size: selectedSize.name,
            toppings: selectedToppings,
            note: productNote
                ? productNote.value.trim()
                : "",
            quantity: quantity
        };

        saveProductToCart(cartItem);

        updateCartCount();

        if (showNotification) {
            showToast(
                `Đã thêm ${currentProduct.name} vào giỏ hàng.`,
                "success"
            );
        }
    }

    /**
     * Lưu sản phẩm vào localStorage.
     */
    function saveProductToCart(newItem) {
        let cart = getCart();

        const itemKey = createCartItemKey(newItem);

        const existingItem = cart.find(function (item) {
            return createCartItemKey(item) === itemKey;
        });

        if (existingItem) {
            existingItem.quantity =
                Number(existingItem.quantity) +
                Number(newItem.quantity);
        } else {
            cart.push(newItem);
        }

        localStorage.setItem(
            CART_KEY,
            JSON.stringify(cart)
        );
    }

    /**
     * Tạo khóa riêng cho từng món.
     *
     * Hai món giống nhau nhưng khác size hoặc topping
     * sẽ được xem là hai sản phẩm khác nhau.
     */
    function createCartItemKey(item) {
        const toppingNames = Array.isArray(item.toppings)
            ? item.toppings
                .map(function (topping) {
                    return topping.name;
                })
                .sort()
                .join("-")
            : "";

        return [
            item.id,
            item.size || "",
            toppingNames,
            item.note || ""
        ].join("_");
    }

    function getCart() {
        try {
            const cartData = localStorage.getItem(CART_KEY);
            const cart = cartData ? JSON.parse(cartData) : [];

            return Array.isArray(cart) ? cart : [];
        } catch (error) {
            console.error("Không thể đọc giỏ hàng:", error);
            return [];
        }
    }

    /**
     * Cập nhật số lượng hiển thị trên biểu tượng giỏ hàng.
     */
    function updateCartCount() {
        if (window.MocCoffee?.updateCartCount) {
            window.MocCoffee.updateCartCount();
            return;
        }

        const totalQuantity = getCart().reduce(
            function (total, item) {
                return total +
                    (Number(item.quantity) || 0);
            },
            0
        );

        document
            .querySelectorAll(".cart-count")
            .forEach(function (element) {
                element.textContent = totalQuantity;

                element.classList.toggle(
                    "d-none",
                    totalQuantity === 0
                );
            });
    }

    /**
     * Hiển thị sản phẩm liên quan.
     */
    function renderRelatedProducts() {
        if (!relatedProducts) {
            return;
        }

        let related = products.filter(function (product) {
            return (
                product.category ===
                currentProduct.category &&
                product.id !== currentProduct.id
            );
        });

        if (related.length < 3) {
            const otherProducts = products.filter(
                function (product) {
                    return (
                        product.id !== currentProduct.id &&
                        !related.some(function (item) {
                            return item.id === product.id;
                        })
                    );
                }
            );

            related = related.concat(otherProducts);
        }

        relatedProducts.innerHTML = related
            .slice(0, 3)
            .map(function (product) {
                return `
                    <div class="col-md-4 mb-4">
                        <div class="card product-card h-100">
                            <img
                                src="${product.image}"
                                class="card-img-top"
                                alt="${escapeHTML(product.name)}"
                                onerror="
                                    this.src='../assets/images/products/default-product.jpg'
                                "
                            >

                            <div class="card-body">
                                <span class="badge bg-light text-dark mb-2">
                                    ${escapeHTML(product.category)}
                                </span>

                                <h5 class="card-title">
                                    ${escapeHTML(product.name)}
                                </h5>

                                <div class="d-flex justify-content-between align-items-center">
                                    <strong class="text-primary">
                                        ${formatCurrency(product.price)}
                                    </strong>

                                    <a
                                        href="product-detail.html?id=${product.id}"
                                        class="btn btn-outline-primary btn-sm"
                                    >
                                        Xem chi tiết
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            })
            .join("");
    }

    /**
     * Hiển thị thông báo.
     */
    function showToast(message, type = "success") {
        let toastContainer =
            document.getElementById("toastContainer");

        if (!toastContainer) {
            toastContainer = document.createElement("div");
            toastContainer.id = "toastContainer";

            toastContainer.className =
                "position-fixed top-0 end-0 p-3";

            toastContainer.style.zIndex = "1080";

            document.body.appendChild(toastContainer);
        }

        const toastElement =
            document.createElement("div");

        toastElement.className =
            `alert alert-${type} alert-dismissible shadow`;

        toastElement.setAttribute("role", "alert");

        toastElement.innerHTML = `
            <i class="bi bi-check-circle-fill me-2"></i>
            ${escapeHTML(message)}

            <button
                type="button"
                class="btn-close"
                aria-label="Đóng"
            ></button>
        `;

        toastContainer.appendChild(toastElement);

        const closeButton =
            toastElement.querySelector(".btn-close");

        closeButton.addEventListener("click", function () {
            toastElement.remove();
        });

        setTimeout(function () {
            toastElement.remove();
        }, 3000);
    }

    function showProductNotFound() {
        const productDetail =
            document.getElementById("productDetail");

        if (productDetail) {
            productDetail.innerHTML = `
                <div class="text-center py-5">
                    <i class="bi bi-exclamation-circle display-3 text-warning"></i>

                    <h2 class="mt-3">
                        Không tìm thấy sản phẩm
                    </h2>

                    <p class="text-muted">
                        Sản phẩm không tồn tại hoặc đã bị xóa.
                    </p>

                    <a href="menu.html" class="btn btn-primary">
                        Quay lại thực đơn
                    </a>
                </div>
            `;
        }
    }

    function formatCurrency(amount) {
        if (window.MocCoffee?.formatCurrency) {
            return window.MocCoffee.formatCurrency(amount);
        }

        return new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: "VND"
        }).format(Number(amount) || 0);
    }

    function setText(element, value) {
        if (element) {
            element.textContent = value;
        }
    }

    function escapeHTML(value) {
        return String(value || "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }
});