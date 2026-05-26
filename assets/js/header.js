(function () {
    function initMenu() {
        const burger = document.querySelector('.burger-toggle');
        const headerContent = document.querySelector('.header-content');

        if (burger && headerContent) {
            burger.addEventListener('click', function (e) {
                e.preventDefault(); // Prevents default button behavior
                const isExpanded = burger.getAttribute('aria-expanded') === 'true';
                burger.setAttribute('aria-expanded', !isExpanded);
                burger.classList.toggle('is-active');
                headerContent.classList.toggle('is-open');
                document.body.classList.toggle('no-scroll');
            });
        }
    }

    // Sécurité supplémentaire : s'assure que le script s'exécute même si le DOM est déjà chargé (à cause de defer ou de pannes liées au Livereload)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMenu);
    } else {
        initMenu();
    }
})();
