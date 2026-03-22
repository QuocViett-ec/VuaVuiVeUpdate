import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';

declare global {
  interface Window {
    __vvvN8nChatInitialized?: boolean;
  }
}

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  template: '',
})
export class ChatWidgetComponent implements OnInit {
  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!environment.chatbotEnabled || !environment.chatbotWebhookUrl) return;
    document.getElementById('n8n-chat-script')?.remove();
    document.getElementById('n8n-chat-theme')?.remove();
    document.querySelectorAll('.vvv-chat-suggestions').forEach((node) => node.remove());

    if (!document.getElementById('n8n-chat-css')) {
      const link = document.createElement('link');
      link.id = 'n8n-chat-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/style.css';
      document.head.appendChild(link);
    }

    window.__vvvN8nChatInitialized = true;

    if (!document.getElementById('n8n-chat-theme')) {
      const style = document.createElement('style');
      style.id = 'n8n-chat-theme';
      style.textContent = `
        :root{
          --chat--color--primary:#26623b;
          --chat--color--primary-shade-50:#e8f2e7;
          --chat--color--white:#fffef9;
          --chat--color--dark:#183024;
          --chat--window--width:392px;
          --chat--window--height:620px;
          --chat--border-radius:30px;
          --chat--header--background:linear-gradient(135deg, #245f39 0%, #388e4f 48%, #9cca64 100%);
          --chat--header--color:#ffffff;
          --chat--message--font-size:0.97rem;
          --chat--message--line-height:1.6;
          --chat--message--border-radius:22px;
          --chat--message--bot--background:#ffffff;
          --chat--message--bot--color:#1f3224;
          --chat--message--user--background:linear-gradient(135deg, #2d7a47 0%, #4ba161 100%);
          --chat--message--user--color:#ffffff;
          --chat--textarea--height:56px;
          --chat--toggle--background:#4a9c54;
          --chat--toggle--hover--background:#2d7a47;
        }

        .n8n-chat__window{
          overflow:hidden!important;
          border:1px solid rgba(91, 130, 84, 0.16)!important;
          box-shadow:0 30px 90px rgba(22, 48, 30, 0.22)!important;
          backdrop-filter:blur(16px);
          background:
            radial-gradient(circle at top right, rgba(175, 214, 145, 0.22), transparent 34%),
            linear-gradient(180deg, #f7fbf3 0%, #eef5ea 100%)!important;
        }

        .n8n-chat__header{
          min-height:126px;
          padding:24px 26px 22px!important;
          position:relative;
          overflow:hidden;
          box-shadow:inset 0 -1px 0 rgba(255,255,255,0.18);
        }

        .n8n-chat__header::before{
          content:'';
          position:absolute;
          inset:auto -36px -42px auto;
          width:138px;
          height:138px;
          border-radius:50%;
          background:rgba(255,255,255,0.14);
        }

        .n8n-chat__header::after{
          content:'Ho tro nhanh';
          position:absolute;
          left:26px;
          top:18px;
          padding:6px 12px;
          border-radius:999px;
          background:rgba(255,255,255,0.18);
          color:#f4ffef;
          font-size:0.72rem;
          font-weight:700;
          letter-spacing:0.08em;
          text-transform:uppercase;
        }

        .n8n-chat__header h1,
        .n8n-chat__header-title{
          margin-top:34px!important;
          font-size:1.95rem!important;
          font-weight:800!important;
          letter-spacing:-0.03em;
        }

        .n8n-chat__header p,
        .n8n-chat__header-subtitle{
          margin-top:6px!important;
          opacity:0.92;
          font-size:0.94rem!important;
        }

        .n8n-chat__body,
        .n8n-chat__messages{
          background:transparent!important;
        }

        .n8n-chat__messages{
          padding:14px 16px 10px!important;
        }

        .n8n-chat__message{
          margin-bottom:14px!important;
        }

        .n8n-chat__message--bot,
        .n8n-chat__message--user{
          max-width:86%!important;
          padding:14px 17px!important;
          border:none!important;
          box-shadow:0 10px 28px rgba(39, 61, 42, 0.08)!important;
        }

        .n8n-chat__message--bot{
          border-top-left-radius:10px!important;
        }

        .n8n-chat__message--user{
          border-bottom-right-radius:10px!important;
        }

        .n8n-chat__footer,
        .n8n-chat__input-container{
          background:rgba(255,253,248,0.92)!important;
          border-top:1px solid rgba(122, 156, 98, 0.14)!important;
          padding:14px 16px 16px!important;
          backdrop-filter:blur(10px);
        }

        .n8n-chat__textarea,
        .n8n-chat__input{
          border:1px solid rgba(101, 141, 94, 0.18)!important;
          border-radius:18px!important;
          background:#ffffff!important;
          box-shadow:inset 0 1px 2px rgba(24, 38, 28, 0.04);
          padding:0 56px 0 18px!important;
          font-size:1rem!important;
          color:#173024!important;
          -webkit-text-fill-color:#173024!important;
          caret-color:#245f39!important;
        }

        .n8n-chat__textarea::placeholder,
        .n8n-chat__input::placeholder{
          color:#829180!important;
        }

        .n8n-chat__textarea,
        .n8n-chat__input,
        .n8n-chat__textarea *,
        .n8n-chat__input *{
          color:#173024!important;
          -webkit-text-fill-color:#173024!important;
        }

        .n8n-chat textarea,
        .n8n-chat input{
          color:#173024!important;
          -webkit-text-fill-color:#173024!important;
          caret-color:#245f39!important;
        }

        .n8n-chat__messages::-webkit-scrollbar{
          width:6px;
        }

        .n8n-chat__messages::-webkit-scrollbar-thumb{
          background:rgba(80, 125, 78, 0.24);
          border-radius:999px;
        }

        .vvv-chat-suggestions{
          display:flex;
          flex-wrap:wrap;
          gap:8px;
          padding:8px 16px 2px;
          background:linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0) 100%);
        }

        .vvv-chat-chip{
          border:none;
          border-radius:999px;
          padding:9px 12px;
          background:#ffffff;
          color:#21412c;
          font-size:0.84rem;
          font-weight:600;
          box-shadow:0 8px 18px rgba(40, 74, 48, 0.08);
          border:1px solid rgba(91, 130, 84, 0.12);
          transition:transform .18s ease, box-shadow .18s ease, background .18s ease;
        }

        .vvv-chat-chip:hover{
          transform:translateY(-1px);
          box-shadow:0 12px 22px rgba(40, 74, 48, 0.12);
          background:#f6fbf4;
        }

        .vvv-chat-chip:active{
          transform:translateY(0);
        }

        .vvv-chat-note{
          width:100%;
          font-size:0.76rem;
          color:#5b7361;
          padding:2px 2px 0;
        }

        .n8n-chat__send-button{
          right:24px!important;
          width:38px!important;
          height:38px!important;
          border-radius:50%!important;
          background:linear-gradient(135deg, #5aa653 0%, #2f7d4a 100%)!important;
          color:#ffffff!important;
          box-shadow:0 10px 22px rgba(47, 125, 74, 0.28)!important;
        }

        .n8n-chat__toggle,
        .n8n-chat__button{
          width:68px!important;
          height:68px!important;
          border:none!important;
          box-shadow:0 20px 40px rgba(47, 125, 74, 0.28)!important;
          background:linear-gradient(135deg, #67b15d 0%, #2f7d4a 100%)!important;
        }

        .n8n-chat__toggle{
          position:relative;
        }

        .n8n-chat__toggle::before{
          content:'';
          position:absolute;
          inset:10px;
          border-radius:50%;
          background:radial-gradient(circle at 30% 30%, rgba(255,255,255,0.35), transparent 55%);
        }

        .n8n-chat__toggle:hover,
        .n8n-chat__button:hover{
          transform:translateY(-2px);
        }

        @media (max-width: 640px){
          :root{
            --chat--window--width:calc(100vw - 18px);
            --chat--window--height:min(82vh, 680px);
            --chat--border-radius:24px;
          }

          .n8n-chat__window{
            right:9px!important;
            left:9px!important;
            bottom:92px!important;
            width:auto!important;
          }

          .n8n-chat__header{
            min-height:108px;
            padding:22px 22px 18px!important;
          }

          .n8n-chat__header h1,
          .n8n-chat__header-title{
            font-size:1.65rem!important;
          }

          .vvv-chat-suggestions{
            padding:8px 12px 2px;
          }

          .vvv-chat-chip{
            font-size:0.8rem;
            padding:8px 11px;
          }

          .n8n-chat__toggle,
          .n8n-chat__button{
            width:62px!important;
            height:62px!important;
          }
        }
      `;
      document.head.appendChild(style);
    }

    if (!document.getElementById('n8n-chat-script')) {
      const script = document.createElement('script');
      script.id = 'n8n-chat-script';
      script.type = 'module';
      script.textContent = `
        import { createChat } from 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js';

        const QUICK_QUESTIONS = [
          'Hôm nay có rau củ nào nổi bật?',
          'Gợi ý cho tôi vài sản phẩm bán chạy.',
          'Cách đặt hàng trên VuaVuiVe như thế nào?',
          'Phí giao hàng được tính ra sao?'
        ];

        function sendPrompt(prompt) {
          const input = document.querySelector('.n8n-chat__textarea, .n8n-chat__input');
          const sendButton = document.querySelector('.n8n-chat__send-button');
          if (!input || !sendButton) return;

          input.focus();
          const prototype = input.tagName === 'TEXTAREA'
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype;
          const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

          if (nativeSetter) {
            nativeSetter.call(input, prompt);
          } else {
            input.value = prompt;
          }

          input.dispatchEvent(new Event('input', { bubbles: true }));

          setTimeout(() => {
            sendButton.click();
          }, 80);
        }

        function forceInputStyles() {
          const fields = document.querySelectorAll('.n8n-chat__textarea, .n8n-chat__input, .n8n-chat textarea, .n8n-chat input');
          fields.forEach((field) => {
            field.style.setProperty('color', '#173024', 'important');
            field.style.setProperty('-webkit-text-fill-color', '#173024', 'important');
            field.style.setProperty('caret-color', '#245f39', 'important');
            field.style.setProperty('background', '#ffffff', 'important');
          });
        }

        function mountSuggestions() {
          const body = document.querySelector('.n8n-chat__body') || document.querySelector('.n8n-chat__window');
          if (!body || document.querySelector('.vvv-chat-suggestions')) {
            forceInputStyles();
            return;
          }

          const wrap = document.createElement('div');
          wrap.className = 'vvv-chat-suggestions';
          wrap.innerHTML =
            QUICK_QUESTIONS.map((question) =>
              '<button type="button" class="vvv-chat-chip" data-question="' +
              question.replace(/"/g, '&quot;') +
              '">' + question + '</button>'
            ).join('') +
            '<div class="vvv-chat-note">Gợi ý câu hỏi, bấm để gửi nhanh</div>';

          wrap.addEventListener('click', (event) => {
            const target = event.target.closest('.vvv-chat-chip');
            if (!target) return;
            const question = target.getAttribute('data-question');
            if (question) sendPrompt(question);
          });

          body.insertBefore(wrap, body.firstChild);
          forceInputStyles();
        }

        createChat({
          webhookUrl: '${environment.chatbotWebhookUrl}',
          defaultLanguage: 'vi',
          showWelcomeScreen: false,
          initialMessages: [
            'Xin chào, mình là VuiVe Bot.',
            'Mình có thể hỗ trợ bạn tìm sản phẩm, giá và cách đặt hàng.'
          ],
          i18n: {
            vi: {
              title: 'VuiVe Bot',
              subtitle: 'Tư vấn nhanh cho bạn',
              footer: '',
              getStarted: 'Bắt đầu',
              inputPlaceholder: 'Nhắn cho VuiVe Bot...'
            }
          }
        });

        const observer = new MutationObserver(() => {
          mountSuggestions();
          forceInputStyles();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => {
          mountSuggestions();
          forceInputStyles();
        }, 500);
      `;
      document.body.appendChild(script);
    }
  }
}
