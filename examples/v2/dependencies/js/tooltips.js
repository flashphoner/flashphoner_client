/** Bind small, dependency-free help popovers for mouse, keyboard, and touch. */
export function bindTooltips(root = document) {
    function closeAll(except) {
        for (const trigger of root.querySelectorAll(".help-marker")) {
            if (trigger !== except) {
                trigger.setAttribute("aria-expanded", "false");
                trigger.parentElement.dataset.dismissed = "true";
            }
        }
    }
    // Delegation also covers statistics rows added after SDK measurements arrive.
    root.addEventListener("pointerover", (event) => {
        const help = event.target.closest(".help");
        if (help && (!event.relatedTarget || !help.contains(event.relatedTarget))) {
            delete help.dataset.dismissed;
            positionTooltip(help.querySelector(".help-marker"));
        }
    });
    root.addEventListener("focusin", (event) => {
        const trigger = event.target.closest(".help-marker");
        if (trigger) {
            delete trigger.parentElement.dataset.dismissed;
            positionTooltip(trigger);
        }
    });
    root.addEventListener("click", (event) => {
        const trigger = event.target.closest(".help-marker");
        if (trigger) {
            const help = trigger.parentElement;
            event.preventDefault();
            event.stopPropagation();
            const open = trigger.getAttribute("aria-expanded") !== "true";
            closeAll(trigger);
            trigger.setAttribute("aria-expanded", String(open));
            if (open) {
                delete help.dataset.dismissed;
                positionTooltip(trigger);
            } else {
                help.dataset.dismissed = "true";
            }
        } else if (!event.target.closest(".help")) {
            closeAll();
        }
    });
    root.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeAll();
        }
    });
    root.addEventListener("scroll", () => closeAll(), true);
    window.addEventListener?.("resize", () => closeAll());
}

export function createHelp(id, label, text) {
    const help = document.createElement("span");
    help.className = "help";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "help-marker";
    trigger.textContent = "?";
    trigger.setAttribute("aria-label", `Help: ${label}`);
    trigger.setAttribute("aria-describedby", id);
    trigger.setAttribute("aria-expanded", "false");
    const popup = document.createElement("span");
    popup.className = "help-tooltip";
    popup.id = id;
    popup.setAttribute("role", "tooltip");
    popup.textContent = text;
    help.append(trigger, popup);
    return {help, popup};
}

function positionTooltip(trigger) {
    const popup = trigger?.parentElement.querySelector(".help-tooltip");
    if (popup?.dataset.floating !== "true") {
        return;
    }
    const anchor = trigger.getBoundingClientRect();
    const bounds = popup.getBoundingClientRect();
    popup.style.left = `${Math.max(10, Math.min(anchor.left, window.innerWidth - bounds.width - 10))}px`;
    const below = anchor.bottom + 10;
    popup.style.top = `${Math.max(10, below + bounds.height <= window.innerHeight - 10
        ? below : anchor.top - bounds.height - 10)}px`;
}
