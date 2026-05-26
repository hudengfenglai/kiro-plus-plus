import "./style.css";

function bindSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (event) => {
      const href = anchor.getAttribute("href");
      if (!href || href === "#") {
        return;
      }
      const target = document.querySelector(href);
      if (!target) {
        return;
      }
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function bindCopyButtons() {
  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const selector = button.getAttribute("data-copy");
      if (!selector) {
        return;
      }
      const source = document.querySelector(selector);
      if (!source) {
        return;
      }
      const text = source.textContent?.trim() ?? "";
      const original = button.textContent ?? "复制";
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = "已复制";
        button.classList.add("is-copied");
        window.setTimeout(() => {
          button.textContent = original;
          button.classList.remove("is-copied");
        }, 1800);
      } catch (error) {
        console.error("copy failed", error);
      }
    });
  });
}

bindSmoothScroll();
bindCopyButtons();
