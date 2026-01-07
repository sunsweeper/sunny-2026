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
      const response = await fetch(`${config.apiBase}/api/chat?stream=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({ message: text }),
        credentials: 'include',
      });

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream')) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let boundary = buffer.indexOf('\n\n');
          while (boundary !== -1) {
            const raw = buffer.slice(0, boundary).trim();
            buffer = buffer.slice(boundary + 2);
            if (raw.startsWith('data:')) {
              const payload = raw.replace(/^data:\s*/, '');
              try {
                const parsed = JSON.parse(payload);
                if (parsed.token) {
                  replyText += parsed.token;
                  renderOrUpdateAssistant(replyText);
                } else if (parsed.done) {
                  break;
                } else if (parsed.error) {
                  throw new Error(parsed.error);
                }
              } catch (err) {
                console.error('SSE parse error', err);
              }
            }
            boundary = buffer.indexOf('\n\n');
          }
        }
      } else {
        const data = await response.json();
        replyText = data.reply || 'Sorry, I could not respond.';
      }
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
