import "../../../noname.js";
import { createApp } from "vue";
import "./OnloadSplash.vue.js";
import { lib } from "../../library/index.js";
import _sfc_main from "./OnloadSplash.vue2.js";
import { ui } from "../../ui/index.js";
import { game } from "../../game/index.js";
class DefaultSplash {
  id = "style1";
  name = "样式一";
  path = "image/splash/style1/";
  resolve;
  app;
  clicked;
  async init(node, resolve) {
    this.resolve = resolve;
    if (lib.config.touchscreen) {
      node.classList.add("touch");
      lib.setScroll(node);
    }
    if (lib.config.player_border !== "wide") {
      node.classList.add("slim");
    }
    node.dataset.radius_size = lib.config.radius_size;
    node.dataset.splash_style = lib.config.splash_style;
    this.app = createApp(_sfc_main, {
      handle: this.handle.bind(this),
      click: this.click.bind(this)
    });
    this.app.mount(node);
    // 兜底：若 vue 组件渲染失败（splash 空内容），2 秒后显示“点击进入游戏”并绑定点击，避免卡死在纯背景界面
    setTimeout(() => {
      if (node.children.length === 0) {
        node.dataset.fallback = "1";
        const tip = document.createElement("div");
        tip.textContent = "点击进入游戏";
        tip.style.cssText = "position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;color:#d8c9a3;font-size:26px;letter-spacing:6px;text-shadow:0 2px 10px rgba(0,0,0,.7);z-index:9";
        node.appendChild(tip);
        node.addEventListener("click", () => this.resolve(lib.config.mode));
      }
    }, 2000);
    if (lib.config.mousewheel) {
      node.addEventListener("wheel", ui.click.mousewheel);
    }
  }
  async dispose(node) {
    node.delete(1e3);
    await new Promise((resolve) => this.clicked.listenTransition(resolve, 500));
    return true;
  }
  preview(node) {
    node.className = "button character";
    node.style.width = "200px";
    node.style.height = `${node.offsetWidth * 1080 / 2400}px`;
    node.style.display = "flex";
    node.style.flexDirection = "column";
    node.style.alignItems = "center";
    node.style.backgroundSize = "100% 100%";
    node.setBackgroundImage(`image/splash/${this.id}.jpg`);
  }
  handle(mode) {
    return lib.path.join(this.path, `${mode}.jpg`);
  }
  click(mode, node) {
    node.classList.add("clicked");
    if (game.layout !== "mobile" && lib.layoutfixed.indexOf(mode) !== -1) {
      game.layout = "mobile";
      ui.css.layout.href = `${lib.assetURL}layout/${game.layout}/layout.css`;
    } else if (game.layout === "mobile" && lib.config.layout !== "mobile" && lib.layoutfixed.indexOf(mode) === -1) {
      game.layout = lib.config.layout;
      if (game.layout === "default") {
        ui.css.layout.href = "";
      } else {
        ui.css.layout.href = `${lib.assetURL}layout/${game.layout}/layout.css`;
      }
    }
    this.clicked = node;
    this.resolve(mode);
  }
}
export {
  DefaultSplash
};
