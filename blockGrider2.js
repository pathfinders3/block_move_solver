(function () {
  const btnLoadJson = document.getElementById('btnLoadJson');
  const jsonOutput = document.getElementById('jsonOutput');
  const status = document.getElementById('status');

  function setStatus(message, isError) {
    status.textContent = message;
    status.classList.toggle('error', !!isError);
  }

  async function loadJsonFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        setStatus('클립보드에 텍스트가 없습니다.', true);
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (parseError) {
        setStatus('클립보드 텍스트가 JSON 형식이 아닙니다.', true);
        jsonOutput.value = text;
        return;
      }

      jsonOutput.value = JSON.stringify(parsed, null, 2);
      setStatus('JSON을 불러왔습니다.', false);
    } catch (error) {
      setStatus('클립보드 접근에 실패했습니다. 브라우저 권한을 확인해주세요.', true);
    }
  }

  btnLoadJson.addEventListener('click', loadJsonFromClipboard);
})();
