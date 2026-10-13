    </main>

    <footer
        class="px-4 pb-4 text-center text-secondary small"
    >
        &copy;
        <?= date('Y') ?>
        Mộc Coffee. Khu vực quản trị PHP.
    </footer>

</div>

<script
    src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
></script>

<script>
    document.addEventListener(
        'DOMContentLoaded',
        function () {
            const sidebar =
                document.getElementById('admin-sidebar');

            const overlay =
                document.getElementById('sidebar-overlay');

            const openButton =
                document.getElementById(
                    'open-sidebar-button'
                );

            const closeButton =
                document.getElementById(
                    'close-sidebar-button'
                );

            function closeSidebar() {
                sidebar?.classList.remove('show');
                overlay?.classList.remove('show');
            }

            openButton?.addEventListener(
                'click',
                function () {
                    sidebar?.classList.add('show');
                    overlay?.classList.add('show');
                }
            );

            closeButton?.addEventListener(
                'click',
                closeSidebar
            );

            overlay?.addEventListener(
                'click',
                closeSidebar
            );
        }
    );
</script>

</body>
</html>