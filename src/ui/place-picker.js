/**
 * PlacePicker: a text box that suggests places as you type.
 *
 * Suggestions come from the destination index (the binary search tree), so
 * typing "lib" or "block" finds every place with a word that starts that way.
 */
import { el, clear, plural } from './dom.js';

const MAX_SUGGESTIONS = 8;

export class PlacePicker {
  constructor({ mount, inputId, planner, placeholder, onChoose }) {
    this.planner = planner;
    this.onChoose = onChoose;
    this.place = null;
    this.options = [];
    this.active = -1;
    this.listId = `${inputId}-list`;

    this.input = el('input', {
      id: inputId, type: 'text', role: 'combobox', placeholder,
      'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': this.listId,
      autocomplete: 'off', spellcheck: 'false',
    });
    this.toggle = el('button', {
      class: 'combo-toggle', type: 'button', tabindex: -1, 'aria-label': 'Show all places',
      onmousedown: (event) => event.preventDefault(),
      onclick: () => {
        if (this.isOpen()) this.close();
        else { this.input.focus(); this.showAll(); }
      },
    });
    this.list = el('ul', { class: 'combo-list', id: this.listId, role: 'listbox', hidden: true });
    this.note = el('p', { class: 'combo-note', hidden: true });
    this.popup = el('div', { class: 'combo-popup', hidden: true }, this.list, this.note);
    mount.append(this.input, this.toggle, this.popup);

    this.input.addEventListener('input', () => {
      this.place = null;
      this.suggest();
    });
    this.input.addEventListener('keydown', (event) => this.onKey(event));
    this.input.addEventListener('blur', () => this.close());
    this.input.addEventListener('focus', () => this.input.select());
  }

  get text() {
    return this.input.value;
  }

  /** Show a place in the box (or empty it with null) without firing onChoose. */
  set(place) {
    this.place = place;
    this.input.value = place ? place.name : '';
  }

  isOpen() {
    return !this.popup.hidden;
  }

  suggest() {
    const text = this.input.value.trim();
    if (text === '') { this.close(); return; }
    const result = this.planner.suggest(text);
    const places = result.places.slice(0, MAX_SUGGESTIONS);
    const steps = plural(result.comparisons, 'step');
    this.render(places, places.length > 0
      ? `Found by walking the index tree in ${steps}`
      : `No place has a word starting with "${text}". Try "block", "hostel" or an ID like LIB.`);
  }

  showAll() {
    const places = this.planner.sortPlaces(this.planner.locations, 'name', 'merge', null, true).sorted;
    this.render(places, 'All places, A to Z');
  }

  render(places, note) {
    clear(this.list);
    this.options = places;
    this.active = -1;
    places.forEach((place, i) => {
      const category = this.planner.mainCategoryOf(place);
      this.list.append(el('li', {
        role: 'option', id: `${this.listId}-${i}`, 'aria-selected': 'false',
        // mousedown would blur the input before the click lands, so choose on mousedown instead
        onmousedown: (event) => { event.preventDefault(); this.choose(place); },
        onmousemove: () => this.setActive(i),
      },
        el('span', { class: `dot cat-${category.id}`, 'aria-hidden': 'true' }),
        el('span', { class: 'option-name', text: place.name }),
        el('span', { class: 'code', text: place.id }),
      ));
    });
    this.list.hidden = places.length === 0;
    this.note.textContent = note;
    this.note.hidden = false;
    this.popup.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
  }

  setActive(index) {
    const items = this.list.children;
    if (this.active >= 0 && items[this.active]) items[this.active].setAttribute('aria-selected', 'false');
    this.active = index;
    if (index >= 0 && items[index]) {
      items[index].setAttribute('aria-selected', 'true');
      items[index].scrollIntoView({ block: 'nearest' });
      this.input.setAttribute('aria-activedescendant', items[index].id);
    } else {
      this.input.removeAttribute('aria-activedescendant');
    }
  }

  onKey(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.isOpen()) {
        if (this.input.value.trim() === '' || this.place) this.showAll();
        else this.suggest();
        return;
      }
      if (this.options.length === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.setActive((this.active + step + this.options.length) % this.options.length);
    } else if (event.key === 'Enter') {
      if (this.isOpen() && this.active >= 0) {
        event.preventDefault(); // choose the suggestion instead of submitting the form
        this.choose(this.options[this.active]);
      } else {
        this.close();
      }
    } else if (event.key === 'Escape') {
      if (this.isOpen()) { event.preventDefault(); this.close(); }
    }
  }

  choose(place) {
    this.set(place);
    this.close();
    this.onChoose(place);
  }

  close() {
    this.popup.hidden = true;
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
    this.active = -1;
  }

  /** The chosen place, or the best match for whatever text is in the box. */
  resolve() {
    if (this.place) return this.place;
    const match = this.planner.resolve(this.input.value);
    if (match) this.set(match);
    return match;
  }
}
