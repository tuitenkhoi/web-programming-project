/* Tự lưu có trì hoãn (debounce) cho form chỉnh sửa.
   const auto = window.MocAutoSave.create({
     delay: 800,                       // ms sau lần gõ cuối
     statusEl,                         // phần tử aria-live hiển thị trạng thái
     getSnapshot() -> object | null,   // trạng thái hiện tại của form; null = chưa hợp lệ, bỏ qua
     save(current, previous) -> Promise // gửi phần thay đổi; reject khi lỗi
   });
   auto.reset(snapshot)   đặt mốc so sánh (khi mở form / sau khi lưu bằng nút), xóa hẹn giờ và trạng thái
   auto.schedule()        gọi mỗi khi người dùng sửa; chỉ gửi nếu snapshot khác mốc
   auto.cancel()          hủy mọi hẹn giờ (khi đóng form)
   Không gửi request nào nếu snapshot không đổi. Lỗi: báo "Chưa lưu được — đang thử lại" rồi thử lại. */
(function () {
  'use strict';

  function pad(n) { return String(n).padStart(2, '0'); }

  function create(options) {
    var delay = options.delay == null ? 800 : options.delay;
    var retryDelay = options.retryDelay == null ? 3000 : options.retryDelay;
    var maxRetries = options.maxRetries == null ? 5 : options.maxRetries;
    var statusEl = options.statusEl;

    var baseline = null;   // snapshot đã được lưu (JSON)
    var timer = null;
    var saving = false;
    var again = false;     // có thay đổi mới trong lúc đang gửi
    var retries = 0;
    var generation = 0;    // tăng mỗi lần reset/cancel để bỏ kết quả của lần gửi cũ

    function setStatus(text, isError) {
      if (!statusEl) return;
      statusEl.textContent = text;
      statusEl.classList.toggle('text-danger', !!isError);
      statusEl.classList.toggle('text-secondary', !isError);
    }

    function clearTimer() {
      if (timer) { clearTimeout(timer); timer = null; }
    }

    function run() {
      timer = null;
      var current = options.getSnapshot();
      if (!current) return;                       // form chưa hợp lệ
      var serialized = JSON.stringify(current);
      if (serialized === baseline) return;        // không đổi -> không gửi request

      if (saving) { again = true; return; }
      saving = true;
      var myGeneration = generation;
      var previous = baseline ? JSON.parse(baseline) : null;

      Promise.resolve()
        .then(function () { return options.save(current, previous); })
        .then(function () {
          saving = false;
          if (myGeneration !== generation) return;
          baseline = serialized;
          retries = 0;
          var now = new Date();
          setStatus('Đã tự lưu lúc ' + pad(now.getHours()) + ':' + pad(now.getMinutes()), false);
          if (again) { again = false; schedule(); }
        })
        .catch(function () {
          saving = false;
          if (myGeneration !== generation) return;
          again = false;
          if (retries < maxRetries) {
            retries += 1;
            setStatus('Chưa lưu được — đang thử lại', true);
            timer = setTimeout(run, retryDelay);
          } else {
            setStatus('Chưa lưu được — hãy bấm nút Lưu thay đổi', true);
          }
        });
    }

    function schedule() {
      clearTimer();
      retries = 0;
      timer = setTimeout(run, delay);
    }

    return {
      reset: function (snapshot) {
        generation += 1;
        clearTimer();
        saving = false;
        again = false;
        retries = 0;
        baseline = snapshot ? JSON.stringify(snapshot) : null;
        setStatus('', false);
      },
      schedule: schedule,
      cancel: function () { generation += 1; clearTimer(); saving = false; again = false; },
      flushNow: function () { clearTimer(); run(); },
    };
  }

  window.MocAutoSave = { create: create };
})();
