/**
 * Small, explicit DOM helpers shared by the v2 examples.
 *
 * They deliberately cover only the operations needed by the examples. Keeping
 * selectors and mutations visible makes the example easy to read, copy, and
 * change without learning a UI abstraction first.
 */

export function byId(id) {
    const node = document.getElementById(id);
    if (!node) {
        throw new Error(`Missing required element #${id}`);
    }
    return node;
}

export function setText(id, value) {
    byId(id).textContent = value ?? "";
}

export function setValue(id, value) {
    byId(id).value = value ?? "";
}

export function value(id) {
    return byId(id).value;
}

export function numberValue(id) {
    return Number.parseInt(value(id), 10);
}

export function checked(id) {
    return byId(id).checked;
}

export function setChecked(id, isChecked) {
    byId(id).checked = isChecked;
}

export function setDisabled(id, isDisabled) {
    byId(id).disabled = isDisabled;
}

export function setVisible(id, isVisible) {
    byId(id).hidden = !isVisible;
}

export function setButton(id, label, handler, isDisabled = false) {
    const button = byId(id);
    button.textContent = label;
    button.onclick = handler;
    button.disabled = isDisabled;
}

export function emitChange(id) {
    byId(id).dispatchEvent(new Event("change", {bubbles: true}));
}

export function clearChildren(id) {
    byId(id).replaceChildren();
}
