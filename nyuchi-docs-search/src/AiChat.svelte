<script lang="ts">
  import { createAiClient, type ChatMessage, type Citation as CitationData } from './lib/ai-client.js';
  import Citation from './Citation.svelte';

  interface Props {
    baseUrl: string;
    source?: 'nyuchi' | 'bundu';
    initialQuery?: string;
  }

  let { baseUrl, source, initialQuery }: Props = $props();

  let messages: ChatMessage[] = $state([]);
  let input = $state(initialQuery ?? '');
  let streaming = $state(false);
  let currentAssistant = $state('');
  let currentCitations: CitationData[] = $state([]);
  let abortController: AbortController | null = null;

  const client = $derived(createAiClient({ baseUrl, source }));

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    input = '';
    messages = [...messages, { role: 'user', content: text }];
    streaming = true;
    currentAssistant = '';
    currentCitations = [];
    abortController = new AbortController();
    try {
      const local = createAiClient({ baseUrl, source, signal: abortController.signal });
      for await (const ev of local.chat(messages)) {
        if (ev.type === 'token') currentAssistant += ev.text;
        else if (ev.type === 'citations') currentCitations = ev.citations;
        else if (ev.type === 'error') {
          currentAssistant += `\n\n_Error: ${ev.error}_`;
          break;
        } else if (ev.type === 'done') break;
      }
    } finally {
      messages = [
        ...messages,
        { role: 'assistant', content: currentAssistant },
      ];
      streaming = false;
      abortController = null;
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function cancel() {
    abortController?.abort();
  }

  // Send the initial query once on mount if provided.
  let sentInitial = false;
  $effect(() => {
    if (!sentInitial && initialQuery && initialQuery.trim()) {
      sentInitial = true;
      void send();
    }
  });
</script>

<div class="nds-chat" data-testid="ai-chat">
  <div class="nds-thread">
    {#each messages as m, i (i)}
      <div class="nds-msg nds-msg-{m.role}">
        <div class="nds-role">{m.role === 'user' ? 'You' : 'Assistant'}</div>
        <div class="nds-content">{m.content}</div>
      </div>
    {/each}

    {#if streaming}
      <div class="nds-msg nds-msg-assistant">
        <div class="nds-role">Assistant</div>
        <div class="nds-content">{currentAssistant}<span class="nds-caret">▍</span></div>
        {#if currentCitations.length > 0}
          <div class="nds-citations">
            {#each currentCitations as c (c.index)}
              <Citation citation={c} />
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <div class="nds-composer">
    <textarea
      class="nds-composer-input"
      rows="2"
      bind:value={input}
      onkeydown={onKey}
      placeholder="Ask anything about the docs…"
      disabled={streaming}
    ></textarea>
    {#if streaming}
      <button type="button" class="nds-send" onclick={cancel}>Stop</button>
    {:else}
      <button type="button" class="nds-send" onclick={send} disabled={!input.trim()}>
        Send
      </button>
    {/if}
  </div>
</div>

<style>
  .nds-chat {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 320px;
  }
  .nds-thread {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .nds-msg {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .nds-role {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sl-color-gray-3, #a0a0a0);
  }
  .nds-content {
    white-space: pre-wrap;
    color: var(--sl-color-white, #fff);
    line-height: 1.5;
    font-size: 0.9rem;
  }
  .nds-msg-user .nds-content {
    color: var(--mzizi-green, #00875a);
  }
  .nds-caret {
    opacity: 0.6;
    animation: blink 1s steps(2) infinite;
  }
  @keyframes blink {
    50% {
      opacity: 0;
    }
  }
  .nds-citations {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.4rem;
  }
  .nds-composer {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem;
    border-top: 1px solid var(--sl-color-gray-5, #2c2c2c);
  }
  .nds-composer-input {
    flex: 1;
    background: var(--sl-color-gray-6, #1a1a1a);
    border: 1px solid var(--sl-color-gray-5, #2c2c2c);
    border-radius: 0.5rem;
    color: inherit;
    padding: 0.5rem 0.6rem;
    resize: none;
    font: inherit;
    font-size: 0.9rem;
  }
  .nds-send {
    padding: 0 1rem;
    background: var(--mzizi-green, #00875a);
    color: #fff;
    border: none;
    border-radius: 0.5rem;
    font: inherit;
    cursor: pointer;
  }
  .nds-send:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
