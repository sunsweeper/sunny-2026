(function () {
  const defaultConfig = {
    apiBase: 'http://localhost:3001',
  };

  const config = Object.assign({}, defaultConfig, window.SUNNY_WIDGET_CONFIG || {});
  const launcher = document.createElement('button');
  launcher.id = 'sunny-launcher';
  launcher.textContent = '☀️';

  const panel = document.createElement('div');
  panel.id = 'sunny-panel';
  panel.classList.add('hidden');

  const header = document.createElement('div');
  header.id = 'sunny-header';
  header.innerHTML = '<span>Sunny Assistant</span>';
  const closeBtn = document.createElement('button');
  closeBtn.id = 'sunny-close';
  closeBtn.textContent = '×';
  header.appendChild(closeBtn);

  const messagesEl = document.createElement('div');
  messagesEl.id = 'sunny-messages';

  const typingEl = document.createElement('div');
  typingEl.id = 'sunny-typing';
  typingEl.style.display = 'none';
  typingEl.textContent = 'Sunny is typing…';

  const inputRow = document.createElement('div');
  inputRow.id = 'sunny-input-row';
  const input = document.createElement('input');
  input.id = 'sunny-input';
  input.type = 'text';
  input.placeholder = 'Ask Sunny…';
  const sendBtn = document.createElement('button');
  sendBtn.id = 'sunny-send';
  sendBtn.textContent = 'Send';

  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);

  panel.appendChild(header);
  panel.appendChild(messagesEl);
  panel.appendChild(typingEl);
  panel.appendChild(inputRow);

  document.body.appendChild(launcher);
  document.body.appendChild(panel);

  function appendMessage(role, text) {
    const bubble = document.createElement('div');
    bubble.className = `sunny-message ${role}`;
    bubble.textContent = text;
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function setTyping(show) {
    typingEl.style.display = show ? 'block' : 'none';
  }

  async function sendMessage(text) {
    appendMessage('user', text);
    setTyping(true);
    let replyText = '';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: text }),
      });

      if (!response.ok) {
        throw new Error('Request failed');
      }

      const data = await response.json();
      replyText = data.reply || 'Sorry, I could not respond.';
    } catch (err) {
      console.error(err);
      replyText = 'Sorry, something went wrong. Please try again.';
    }

    if (replyText) {
      renderOrUpdateAssistant(replyText, true);
    }
    setTyping(false);
  }

  function renderOrUpdateAssistant(text, forceNew) {
    if (forceNew || !messagesEl.lastElementChild || !messagesEl.lastElementChild.classList.contains('assistant')) {
      appendMessage('assistant', text);
    } else {
      messagesEl.lastElementChild.textContent = text;
    }
  }

  launcher.addEventListener('click', () => {
    panel.classList.toggle('hidden');
  });

  closeBtn.addEventListener('click', () => {
    panel.classList.add('hidden');
  });

  sendBtn.addEventListener('click', () => {
    if (!input.value.trim()) return;
    const text = input.value.trim();
    input.value = '';
    sendMessage(text);
  });

  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendBtn.click();
    }
  });
})();
