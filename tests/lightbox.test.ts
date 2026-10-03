import test from 'node:test';
import assert from 'node:assert/strict';
import {
  openLightbox,
  closeLightbox,
  isLightboxOpen,
  ChallengeDialog
} from '../src/quiz/ChallengeDialog';

// Minimal DOM mock to test lightbox event routing
function setupMockDom() {
  const listeners: Record<string, ((e: any) => void)[]> = {};

  const doc = {
    addEventListener: (event: string, handler: (e: any) => void) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(handler);
    },
    removeEventListener: (event: string, handler: (e: any) => void) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(h => h !== handler);
      }
    },
    dispatchEvent: (event: { type: string; target?: any }) => {
      const handlers = listeners[event.type] || [];
      for (const h of handlers) {
        h(event);
      }
    },
    getElementById: (id: string) => elements[id] || null
  };

  const elements: Record<string, any> = {};

  const lightboxDialog = {
    id: 'image-lightbox',
    open: false,
    showModal: function() { this.open = true; },
    close: function() { this.open = false; },
    addEventListener: function(event: string, handler: (e: any) => void) {
      listeners[`image-lightbox:${event}`] = listeners[`image-lightbox:${event}`] || [];
      listeners[`image-lightbox:${event}`].push(handler);
    }
  };

  const lightboxImg = {
    id: 'lightbox-img',
    src: '',
    alt: ''
  };

  const closeButton = {
    id: 'lightbox-close',
    classList: { contains: (cls: string) => cls === 'lightbox-close-btn' },
    closest: (selector: string) => {
      if (selector === '#lightbox-close' || selector === '.lightbox-close-btn') return closeButton;
      return null;
    },
    onclick: null as any
  };

  const svgIcon = {
    tagName: 'svg',
    closest: (selector: string) => {
      if (selector === '#lightbox-close' || selector === '.lightbox-close-btn') return closeButton;
      return null;
    }
  };

  const backdrop = {
    classList: { contains: (cls: string) => cls === 'lightbox-backdrop' }
  };

  (globalThis as any).document = doc;

  return {
    doc,
    elements,
    lightboxDialog,
    lightboxImg,
    closeButton,
    svgIcon,
    backdrop,
    populateElements: () => {
      elements['image-lightbox'] = lightboxDialog;
      elements['lightbox-img'] = lightboxImg;
      elements['lightbox-close'] = closeButton;
    }
  };
}

test('Lightbox closes when clicking lightbox-close button or its SVG child even when listeners initialized before DOM injection', () => {
  const mock = setupMockDom();

  const challengeDialog = new ChallengeDialog({
    openDialog: () => {},
    closeDialog: () => {},
    playCue: () => {},
    updateHUD: () => {},
    burstPlayer: () => {},
    toast: () => {},
    adventure: {} as any,
    getWorld: () => null as any
  });

  // Step 1: In main.ts line 77, initLightboxListeners was called BEFORE app.innerHTML populated elements!
  challengeDialog.initLightboxListeners();

  // Step 2: Now app.innerHTML runs and elements are present in DOM
  mock.populateElements();

  // Step 3: An image is opened in lightbox
  openLightbox('https://example.com/math-problem.png', 'Đề bài');
  assert.equal(isLightboxOpen(), true, 'Lightbox should be open');
  assert.equal(mock.lightboxImg.src, 'https://example.com/math-problem.png');

  // Step 4: User clicks on the SVG icon inside #lightbox-close
  mock.doc.dispatchEvent({
    type: 'click',
    target: mock.svgIcon,
    stopPropagation: () => {}
  });

  // ASSERTION: Lightbox MUST be closed!
  assert.equal(isLightboxOpen(), false, 'Lightbox must be closed after clicking #lightbox-close icon');
});

test('Lightbox closes when clicking backdrop or pressing cancel/escape', () => {
  const mock = setupMockDom();
  const challengeDialog = new ChallengeDialog({
    openDialog: () => {},
    closeDialog: () => {},
    playCue: () => {},
    updateHUD: () => {},
    burstPlayer: () => {},
    toast: () => {},
    adventure: {} as any,
    getWorld: () => null as any
  });

  challengeDialog.initLightboxListeners();
  mock.populateElements();

  // Test backdrop click
  openLightbox('https://example.com/math-problem.png');
  assert.equal(isLightboxOpen(), true);

  mock.doc.dispatchEvent({
    type: 'click',
    target: mock.backdrop,
    stopPropagation: () => {}
  });
  assert.equal(isLightboxOpen(), false, 'Lightbox must close on backdrop click');

  // Test cancel/escape event
  openLightbox('https://example.com/math-problem.png');
  assert.equal(isLightboxOpen(), true);

  mock.doc.dispatchEvent({
    type: 'cancel',
    target: mock.lightboxDialog,
    preventDefault: () => {}
  });
  assert.equal(isLightboxOpen(), false, 'Lightbox must close on cancel event');
});

