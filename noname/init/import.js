import "../../noname.js";
import { game } from "../game/index.js";
import { lib } from "../library/index.js";
import { _status } from "../status/index.js";
async function importCardPack(name) {
  await importFunction("card", `/card/${name}`);
}
async function importCharacterPack(name) {
  const path = false ? `/character/${name}/index` : `/character/${name}`;
  await importFunction("character", path).catch((e) => {
    console.error(`武将包《${name}》加载失败`, e);
  });
}
async function importExtension(name) {
  if (!game.hasExtension(name) && !lib.config.all.stockextension.includes(name)) {
    await game.import("extension", await createEmptyExtension(name));
    return;
  }
  if (lib.config.fuck_sojson && !_status.connectMode) {
    await checkExtensionSojson(name);
  }
  try {
    await importFunction("extension", `/extension/${name}/extension`);
  } catch (e) {
    console.error(`扩展《${name}》加载失败`, e);
    let close = confirm(`扩展《${name}》加载失败，是否关闭此扩展？错误信息: 
${e instanceof Error ? e.stack : String(e)}`);
    if (close) {
      game.saveConfig(`extension_${name}_enable`, false);
      await game.import("extension", await createEmptyExtension(name));
    }
  }
}
async function importMode(name) {
  if (lib.mode[name] && lib.mode[name].fromextension) {
    let loadModeMethod = lib.init["setMode_" + name];
    if (typeof loadModeMethod === "function") {
      await Promise.resolve(loadModeMethod());
      return;
    }
  }
  const alreadyModernMode = lib.config.moderned_modes || [];
  const path = alreadyModernMode.includes(name) ? `/mode/${name}/index` : `/mode/${name}`;
  await importFunction("mode", path);
}
async function importFunction(type, path) {
  let resolvedPath = path;
  if (path.startsWith("/")) {
    // 根相对路径：转换为基于页面根的完整 URL（适配子路径部署）
    resolvedPath = new URL(path.slice(1), document.baseURI).href;
  }
  // 动态导入加超时与重试：慢网/HTTP2 断流时自动恢复，避免启动挂起
  const importWithRetry = async (suffix) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await Promise.race([
          import(
            /* @vite-ignore */
            resolvedPath + suffix
          ),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`import timeout: ${resolvedPath}${suffix}`)), 30000)
          )
        ]);
      } catch (error) {
        if (attempt === 3) throw error;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  };
  const modeContent = await importWithRetry(".js").catch(async (e) => {
    if (window.isSecureContext) {
      try {
        return await importWithRetry(".ts");
      } catch {
        throw e;
      }
    }
    throw e;
  });
  if (!modeContent.type) return;
  if (modeContent.type !== type) {
    throw new Error(`Loaded Content doesn't match "${type}" (received "${modeContent.type}").`);
  }
  await game.import(type, modeContent.default);
}
async function checkExtensionSojson(name) {
  const suffixes = window.isSecureContext ? [".js", ".ts"] : [".js"];
  for (const suffix of suffixes) {
    const file = `extension/${name}/extension${suffix}`;
    try {
      const code = await game.promises.readFileAsText(file);
      if (code.includes("sojson") || code.includes("jsjiami") || code.includes("var _0x")) {
        alert(`检测到您安装了使用免费版sojson进行加密的扩展。请谨慎使用这些扩展，避免游戏数据遭到破坏。
扩展名称：${name}`);
        return;
      }
    } catch {
    }
  }
}
async function createEmptyExtension(name) {
  const extensionInfo = await lib.init.promises.json(`${lib.assetURL}extension/${name}/info.json`).then(
    (info) => info,
    () => {
      return {
        name,
        intro: `扩展<b>《${name}》</b>尚未开启，请开启后查看信息。（建议扩展添加info.json以在关闭时查看信息）`,
        author: "未知",
        diskURL: "",
        forumURL: "",
        version: "1.0.0"
      };
    }
  );
  return {
    name: extensionInfo.name,
    editable: false,
    arenaReady() {
    },
    content(config, pack) {
    },
    prepare() {
    },
    precontent() {
    },
    config: {},
    help: {},
    package: {
      translation: extensionInfo.translation,
      nopack: true,
      intro: extensionInfo.intro ? extensionInfo.intro.replace("${assetURL}", lib.assetURL) : "",
      author: extensionInfo.author ?? "未知",
      diskURL: extensionInfo.diskURL ?? "",
      forumURL: extensionInfo.forumURL ?? "",
      version: extensionInfo.version ?? "1.0.0"
    },
    files: {
      character: [],
      card: [],
      skill: [],
      audio: []
    }
  };
}
export {
  createEmptyExtension,
  importCardPack,
  importCharacterPack,
  importExtension,
  importMode
};
