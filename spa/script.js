(function ($) {
    "use strict";

    var NAME_PATTERN = /^[\p{L}\p{M}' .-]{3,60}$/u;
    var PHONE_PATTERN = /^[0-9]{7,8}$/;
    var TOTAL_SECONDS = 600;
    var TIMER_TEMPLATE =
        '<div class="timer-icon">⏱</div>' +
        '<div class="timer-information">' +
        "<strong>Tiempo para confirmar tu reserva</strong>" +
        '<span id="timerMessage">Organiza tu reserva antes de que termine el tiempo.</span>' +
        "</div>" +
        '<div class="timer-clock" id="timerClock">10:00</div>' +
        '<button type="button" class="timer-restart" id="timerRestart">Reiniciar</button>';

    var cartItems = [];
    var toastTimeout = null;
    var catalog = {};
    var packages = {};
    var maxPeople = 6;
    var timerSeconds = TOTAL_SECONDS;
    var timerInterval = null;
    var timerStarted = false;

    function bind(eventName, selector, handler) {
        $(document).off(eventName, selector).on(eventName, selector, handler);
    }

    function hydrate(selector) {
        $(selector).not("[data-hidratado]").attr("data-hidratado", "true");
    }

    function formatPrice(value) {
        return value + " Bs";
    }

    function pad(number) {
        return String(number).padStart(2, "0");
    }

    function todayString() {
        var now = new Date();
        return now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
    }

    function formatDateText(value) {
        var parts = value.split("-");
        return parts[2] + "/" + parts[1] + "/" + parts[0];
    }

    function sanitizeText(text, maxLength) {
        return String(text)
            .replace(/[\u0000-\u001F\u007F]/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, maxLength);
    }

    function isValidName(name) {
        return NAME_PATTERN.test(name);
    }

    function isValidPhone(phone) {
        return PHONE_PATTERN.test(phone);
    }

    function isValidPeople(quantity) {
        return Number.isInteger(quantity) && quantity >= 1 && quantity <= maxPeople;
    }

    function isValidDate(value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return false;
        }

        var parts = value.split("-").map(Number);
        var date = new Date(parts[0], parts[1] - 1, parts[2]);

        if (date.getFullYear() !== parts[0] || date.getMonth() !== parts[1] - 1 || date.getDate() !== parts[2]) {
            return false;
        }

        return value >= todayString();
    }

    async function loadMenu() {
        var response = await fetch("menu.json");

        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }

        return response.json();
    }

    function showToast(message) {
        var $toast = $("#toast");

        $toast.text(message).addClass("show");
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(function () {
            $toast.removeClass("show");
        }, 2500);
    }

    function addItem(name, price, quantity) {
        var existing = cartItems.find(function (item) {
            return item.name === name && item.price === price;
        });

        if (existing) {
            existing.quantity += quantity;
        } else {
            cartItems.push({ name: name, price: price, quantity: quantity });
        }
    }

    function getTotal() {
        return cartItems.reduce(function (sum, item) {
            return sum + item.price * item.quantity;
        }, 0);
    }

    function getCount() {
        return cartItems.reduce(function (sum, item) {
            return sum + item.quantity;
        }, 0);
    }

    function renderCart() {
        var $list = $("#cartItems").empty();

        if (cartItems.length === 0) {
            $list.append($("<p>", { "class": "empty-cart" }).text("Todavía no agregaste tratamientos."));
        }

        cartItems.forEach(function (item, index) {
            var people = item.quantity === 1 ? " persona" : " personas";
            var $info = $("<div>", { "class": "cart-item-info" })
                .append($("<strong>").text(item.name))
                .append($("<span>").text(item.quantity + people + " x " + formatPrice(item.price)));

            var $remove = $("<button>", { type: "button", "class": "remove-item" })
                .text("Eliminar")
                .attr("data-index", index);

            $("<div>", { "class": "cart-item" })
                .append($info)
                .append($("<strong>").text(formatPrice(item.price * item.quantity)))
                .append($remove)
                .appendTo($list);
        });

        $("#cartCount").text(getCount());
        $("#cartTotal").text(formatPrice(getTotal()));
        hydrate(".remove-item");
    }

    function openCart() {
        $("#cartPanel").addClass("open");
        $("#cartOverlay").addClass("show");
    }

    function closeCart() {
        $("#cartPanel").removeClass("open");
        $("#cartOverlay").removeClass("show");
    }

    function initCartUI() {
        bind("click", "#cartOpen, #openCartFromOrders", openCart);
        bind("click", "#cartClose, #cartOverlay", closeCart);
        bind("click", ".remove-item", function () {
            cartItems.splice(Number($(this).attr("data-index")), 1);
            renderCart();
        });

        hydrate("#cartOpen, #openCartFromOrders, #cartClose, #cartOverlay");
        renderCart();
    }

    function closeMenu() {
        $("#navLinks").removeClass("open");
        $("#menuToggle").attr("aria-expanded", "false");
    }

    function initNavigation(onViewChange) {
        function changeView(view) {
            if (!$("#" + view).hasClass("page-section")) {
                return;
            }

            $(".page-section").removeClass("active");
            $("#" + view).addClass("active");

            $("[data-view]").each(function () {
                $(this).toggleClass("active", $(this).attr("data-view") === view);
            });

            closeMenu();

            if (onViewChange) {
                onViewChange(view);
            }

            $("html, body").animate({ scrollTop: 0 }, 250);
        }

        bind("click", "[data-view]", function (event) {
            event.preventDefault();
            changeView($(this).attr("data-view"));
        });

        bind("click", "#menuToggle", function () {
            var isOpen = $("#navLinks").toggleClass("open").hasClass("open");
            $(this).attr("aria-expanded", String(isOpen));
        });

        $(window).off("resize.navegacion").on("resize.navegacion", function () {
            if (window.innerWidth > 800) {
                closeMenu();
            }
        });

        hydrate("[data-view], #menuToggle");
    }

    function initTheme() {
        bind("click", "#themeToggle", function () {
            var isDark = $("body").toggleClass("dark-mode").hasClass("dark-mode");
            $(this).text(isDark ? "☀" : "☾");
        });

        hydrate("#themeToggle");
    }

    function createImage(src, alt) {
        return $("<img>")
            .attr("loading", "lazy")
            .attr("decoding", "async")
            .attr("alt", alt)
            .attr("src", src);
    }

    function createServiceOption(service) {
        var $info = $("<div>")
            .append($("<small>").text(service.duracion))
            .append($("<strong>").text(service.nombre))
            .append($("<b>").text(formatPrice(service.precio)));

        return $("<article>", { "class": "service-option" })
            .append(createImage(service.imagen, service.nombre))
            .append($info);
    }

    function closeCard($card) {
        $card.removeClass("open");
        $card.find(".category-header").attr("aria-expanded", "false");
        $card.find(".category-arrow").text("+");
    }

    function renderHighlights(destacados) {
        var $container = $("#priceInfo").empty();

        destacados.forEach(function (item) {
            $("<div>")
                .append($("<strong>").text(item.titulo))
                .append($("<span>").text(item.detalle))
                .append($("<b>").text(formatPrice(item.precio)))
                .appendTo($container);
        });
    }

    function renderTreatments(categorias) {
        var $container = $("#treatmentMenu").empty();

        categorias.forEach(function (category) {
            var $header = $("<button>", { "class": "category-header", "aria-expanded": "false", type: "button" })
                .append($("<span>", { "class": "category-icon" }).text(category.icono))
                .append(
                    $("<span>", { "class": "category-title" })
                        .append($("<strong>").text(category.nombre))
                        .append($("<small>").text(category.servicios.length + " tratamientos"))
                )
                .append($("<span>", { "class": "category-arrow" }).text("+"));

            var $details = $("<div>", { "class": "category-details" });

            category.servicios.forEach(function (service) {
                $details.append(createServiceOption(service));
            });

            $("<article>", { "class": "category-card" })
                .append($header)
                .append($details)
                .appendTo($container);
        });

        hydrate(".category-header");
    }

    function renderPackages(paquetes) {
        var $container = $("#packageGrid").empty();

        paquetes.forEach(function (item) {
            $("<article>", { "class": "package-card" })
                .append(createImage(item.imagen, item.nombre))
                .append($("<h3>").text(item.nombre))
                .append($("<p>").text(item.descripcion))
                .append($("<small>").text(item.duracion))
                .append($("<strong>").text(formatPrice(item.precio)))
                .appendTo($container);
        });
    }

    function initMenuInteractions() {
        bind("click", ".category-header", function () {
            var $card = $(this).closest(".category-card");
            var isOpen = $card.toggleClass("open").hasClass("open");

            $(this).attr("aria-expanded", String(isOpen));
            $card.find(".category-arrow").text(isOpen ? "−" : "+");
        });

        bind("input", "#treatmentSearch", function () {
            var search = $(this).val().toLowerCase().trim();

            $("#treatmentMenu .category-card").each(function () {
                var $card = $(this);
                var matches = $card.text().toLowerCase().includes(search);

                $card.toggleClass("is-hidden", !matches);

                if (!matches) {
                    closeCard($card);
                }
            });
        });
    }

    function fillSelect($select, options) {
        $select.empty();
        options.forEach(function (option) {
            $("<option>").val(option.value).text(option.text).appendTo($select);
        });
    }

    function currentService() {
        var list = catalog[$("#treatCategory").val()] || [];

        return list.find(function (service) {
            return service.nombre === $("#treatService").val();
        });
    }

    function updateServices() {
        var list = catalog[$("#treatCategory").val()] || [];

        fillSelect($("#treatService"), list.map(function (service) {
            return { value: service.nombre, text: service.nombre + " (" + service.duracion + ")" };
        }));
        updateTreatPrice();
    }

    function updateTreatPrice() {
        var service = currentService();

        $("#treatPrice").text(service ? formatPrice(service.precio) : "");
    }

    function readBooking(prefix, schedule) {
        var people = Number($("#" + prefix + "People").val());
        var date = $("#" + prefix + "Date").val();
        var time = $("#" + prefix + "Time").val();

        if (!isValidPeople(people)) {
            showToast("Elige entre 1 y " + maxPeople + " personas");
            return null;
        }

        if (!isValidDate(date)) {
            showToast("Elige una fecha válida desde hoy");
            return null;
        }

        if (schedule.indexOf(time) === -1) {
            showToast("Elige un horario disponible");
            return null;
        }

        return { people: people, date: date, time: time };
    }

    function addAndRefresh(name, price, people) {
        addItem(name, price, people);
        renderCart();
        showToast("Agregado a tu reserva");
    }

    function initOrders(data) {
        var schedule = data.horarios;
        var scheduleOptions = schedule.map(function (hour) {
            return { value: hour, text: hour };
        });

        maxPeople = data.maxPersonas;
        catalog = {};
        packages = {};

        data.categorias.forEach(function (category) {
            catalog[category.nombre] = category.servicios;
        });

        data.paquetes.forEach(function (item) {
            packages[item.nombre] = item;
        });

        fillSelect($("#treatCategory"), data.categorias.map(function (category) {
            return { value: category.nombre, text: category.nombre };
        }));
        fillSelect($("#packageSelect"), data.paquetes.map(function (item) {
            return { value: item.nombre, text: item.nombre + " - " + formatPrice(item.precio) };
        }));
        fillSelect($("#treatTime"), scheduleOptions);
        fillSelect($("#packageTime"), scheduleOptions);

        $("#treatDate, #packageDate").attr("min", todayString()).val(todayString());
        $("#treatPeople, #packagePeople").attr("max", maxPeople);

        updateServices();

        bind("change", "#treatCategory", updateServices);
        bind("change", "#treatService", updateTreatPrice);

        bind("click", "#addTreatment", function () {
            var booking = readBooking("treat", schedule);
            var service = currentService();

            if (!booking || !service) {
                return;
            }

            var name = service.nombre + " (" + service.duracion + ") - " + formatDateText(booking.date) + " " + booking.time;

            addAndRefresh(name, service.precio, booking.people);
        });

        bind("click", "#addPackage", function () {
            var booking = readBooking("package", schedule);
            var item = packages[$("#packageSelect").val()];

            if (!booking || !item) {
                return;
            }

            var name = item.nombre + " (" + item.duracion + ") - " + formatDateText(booking.date) + " " + booking.time;

            addAndRefresh(name, item.precio, booking.people);
        });

        hydrate("#addTreatment, #addPackage, #treatCategory, #treatService");
    }

    function updateTimer() {
        var $box = $(".order-timer");
        var minutes = Math.floor(timerSeconds / 60);
        var rest = timerSeconds % 60;

        $("#timerClock").text(pad(minutes) + ":" + pad(rest));
        $box.removeClass("timer-warning timer-finished");

        if (timerSeconds <= 60 && timerSeconds > 0) {
            $box.addClass("timer-warning");
            $("#timerMessage").text("¡Queda poco tiempo para organizar tu reserva!");
        } else if (timerSeconds > 60) {
            $("#timerMessage").text("Organiza tu reserva antes de que termine el tiempo.");
        }

        if (timerSeconds <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            $box.addClass("timer-finished");
            $("#timerClock").text("00:00");
            $("#timerMessage").text("El tiempo terminó. Puedes reiniciar el temporizador.");
            showToast("El tiempo para organizar tu reserva terminó");
        }
    }

    function tickTimer() {
        if (timerSeconds > 0) {
            timerSeconds -= 1;
            updateTimer();
        }
    }

    function startOrderTimer() {
        if (timerStarted) {
            return;
        }

        timerStarted = true;
        timerInterval = setInterval(tickTimer, 1000);
        updateTimer();
    }

    function resetOrderTimer() {
        clearInterval(timerInterval);
        timerSeconds = TOTAL_SECONDS;
        timerStarted = true;
        timerInterval = setInterval(tickTimer, 1000);
        updateTimer();
    }

    function initOrderTimer() {
        if ($(".order-timer").length === 0) {
            $("<div>", { "class": "order-timer" })
                .html(TIMER_TEMPLATE)
                .insertBefore("#reservas .order-layout");
        }

        bind("click", "#timerRestart", function () {
            resetOrderTimer();
            showToast("Temporizador reiniciado");
        });

        hydrate("#timerRestart");
    }

    function closeOrderModal() {
        $("#orderModal").removeClass("show");
    }

    function buildMessage(businessName, name, phone, note) {
        var message = "Hola, quiero reservar en " + businessName + ":\n\n";

        message += "Nombre: " + name + "\n";
        message += "Celular: " + phone + "\n\n";
        message += "MI RESERVA:\n";

        cartItems.forEach(function (item) {
            message += "- " + item.name + " | " + item.quantity + " persona(s) = " + formatPrice(item.price * item.quantity) + "\n";
        });

        message += "\nTOTAL: " + formatPrice(getTotal());

        if (note) {
            message += "\n\nDetalle adicional: " + note;
        }

        return message;
    }

    function initCheckout(business) {
        bind("click", "#checkoutButton", function () {
            if (cartItems.length === 0) {
                showToast("Primero agrega algún tratamiento");
                return;
            }

            closeCart();
            $("#orderModal").addClass("show");
        });

        bind("click", "#modalClose", closeOrderModal);

        bind("click", "#orderModal", function (event) {
            if (event.target === this) {
                closeOrderModal();
            }
        });

        bind("submit", "#orderForm", function (event) {
            event.preventDefault();

            var name = sanitizeText($("#customerName").val(), 60);
            var phone = sanitizeText($("#customerPhone").val(), 8);
            var note = sanitizeText($("#customerNote").val(), 200);
            var valid = true;

            $("#nameError, #phoneError, #formMessage").text("");

            if (!isValidName(name)) {
                $("#nameError").text("Usa solo letras, espacios, punto o guion (3 a 60 caracteres).");
                valid = false;
            }

            if (!isValidPhone(phone)) {
                $("#phoneError").text("Escribe un celular válido de 7 u 8 dígitos.");
                valid = false;
            }

            if (!valid) {
                return;
            }

            var url = "https://wa.me/" + business.whatsapp + "?text=" +
                encodeURIComponent(buildMessage(business.nombre, name, phone, note));

            window.open(url, "_blank", "noopener,noreferrer");

            closeOrderModal();
            $("#orderForm")[0].reset();
            cartItems = [];
            renderCart();
            showToast("Reserva preparada correctamente");
        });

        hydrate("#checkoutButton, #modalClose, #orderModal, #orderForm");
    }

    function registerServiceWorker() {
        if (!("serviceWorker" in navigator)) {
            return;
        }

        function register() {
            navigator.serviceWorker.register("./sw.js").catch(function (error) {
                console.error("No se pudo registrar el Service Worker:", error);
            });
        }

        if (document.readyState === "complete") {
            register();
        } else {
            window.addEventListener("load", register);
        }
    }

    function initNetStatus() {
        function update() {
            var online = navigator.onLine;

            $("#netStatus").text(online ? "En línea" : "Sin conexión").toggleClass("offline", !online);
        }

        $(window).off("online.red offline.red").on("online.red offline.red", update);
        update();
    }

    function initInstallButton() {
        var deferredPrompt = null;

        window.addEventListener("beforeinstallprompt", function (event) {
            event.preventDefault();
            deferredPrompt = event;
            $("#installBtn").prop("hidden", false);
        });

        $("#installBtn").off("click.instalar").on("click.instalar", async function () {
            if (!deferredPrompt) {
                return;
            }

            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            deferredPrompt = null;
            $(this).prop("hidden", true);
        });
    }

    async function start() {
        registerServiceWorker();
        initNetStatus();
        initInstallButton();

        $("#year").text(new Date().getFullYear());

        initNavigation(function (view) {
            if (view === "reservas") {
                startOrderTimer();
            }
        });
        initTheme();
        initCartUI();
        initOrderTimer();
        initMenuInteractions();

        try {
            var data = await loadMenu();

            renderHighlights(data.destacados);
            renderTreatments(data.categorias);
            renderPackages(data.paquetes);
            initOrders(data);
            initCheckout(data.negocio);
        } catch (error) {
            console.error("No se pudo cargar el menú:", error);
            $("#treatmentMenu").empty().append(
                $("<p>", { "class": "info-note" }).text("No se pudieron cargar los tratamientos. Revisa tu conexión e inténtalo de nuevo.")
            );
        }
    }

    $(start);
})(window.jQuery);
