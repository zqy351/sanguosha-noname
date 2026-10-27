import { game, get, lib, ui } from "noname";
import { loadCharacter } from "../../noname/init/loading.js";

// 自定义武将：势曹植（魏，4体力）—— 酒诗 / 七章 / 华
export const type = "extension";
export default {
  name: "shicaozhi",
  editable: false,
  async content() {
    const pack = {
      name: "shicaozhi",
      connect: true,
      character: {
        shicaozhi: {
          sex: "male",
          group: "wei",
          hp: 4,
          skills: ["jiushi", "qizhang", "hua"]
        }
      },
      skill: {
        // ========== 酒诗 ==========
        jiushi: {
          audio: 2,
          group: ["jiushi1", "jiushi2", "jiushi3", "jiushi4"]
        },
        // ① 需要使用酒时，正面朝上：翻面视为使用一张酒
        jiushi1: {
          hiddenCard(player, name) {
            if (name == "jiu") return !player.isTurnedOver();
            return false;
          },
          audio: "jiushi",
          enable: "chooseToUse",
          sourceSkill: "jiushi",
          filter(event, player) {
            if (player.isTurnedOver()) return false;
            return event.filterCard({ name: "jiu", isCard: true }, player, event);
          },
          async content(event, trigger, player) {
            if (event.getParent(2).type == "dying") {
              event.dying = player;
              event.type = "dying";
            }
            await player.turnOver();
            await player.useCard({ name: "jiu", isCard: true }, player);
          }
        },
        // ② 受到伤害后，背面朝上且未因此次伤害发动过酒诗：翻面并视为使用一张酒
        jiushi2: {
          audio: "jiushi",
          trigger: { player: "damageEnd" },
          sourceSkill: "jiushi",
          filter(event, player) {
            if (!player.isTurnedOver()) return false;
            if (player.hasHistory("useCard", (evt) => {
              if (evt.card.name != "jiu" || evt.getParent().name != "jiushi1") return false;
              return evt.getParent("damage", true) == event;
            })) return false;
            return true;
          },
          prompt: "是否发动【酒诗】，将武将牌翻面，视为使用一张酒？",
          async content(event, trigger, player) {
            await player.turnOver();
            await player.useCard({ name: "jiu", isCard: true }, player);
          }
        },
        // ③ 翻面后：获得牌堆中一张锦囊牌和一张基本牌
        jiushi3: {
          audio: "jiushi",
          trigger: { player: "turnOverAfter" },
          sourceSkill: "jiushi",
          forced: true,
          async content(event, trigger, player) {
            const trick = ui.cardPile.filter((card) => get.type2(card) == "trick").randomGet();
            const basic = ui.cardPile.filter((card) => get.type2(card) == "basic").randomGet();
            const cards = [trick, basic].filter(Boolean);
            if (cards.length) await player.gain(cards, "gain2", "log");
          }
        },
        // ④ 造成伤害时，背面朝上：翻回正面，本回合杀伤害基数+1
        jiushi4: {
          audio: "jiushi",
          trigger: { player: "damageBegin" },
          sourceSkill: "jiushi",
          filter(event, player) {
            return player.isTurnedOver() && event.card?.name == "sha";
          },
          prompt: "是否发动【酒诗】，翻回正面，本回合杀伤害基数+1？",
          async content(event, trigger, player) {
            await player.turnOver();
            trigger.num++;
            player.addTempSkill("jiushi4_damage", "turnEnd");
          }
        },
        jiushi4_damage: {
          temp: true,
          mod: {
            damage: {
              add(card, player, num) {
                if (card.name == "sha") return 1;
              }
            }
          }
        },
        // ========== 七章（限定技） ==========
        qizhang: {
          audio: 2,
          limited: true,
          enable: "phaseUse",
          usable: 1,
          filter(event, player) {
            return player.hp > 1;
          },
          async content(event, trigger, player) {
            await player.loseHp(1);
            const seal = "qizhang_seal_" + player.playerid;
            for (const target of game.filterPlayer()) {
              if (target == player) continue;
              for (const sk of target.getSkills()) {
                if (!target.disabledSkills[sk]?.includes(seal)) {
                  target.disableSkill(seal, sk);
                }
              }
            }
            player.addTempSkill(["qizhang_seal", "qizhang_club"], "turnEnd");
          }
        },
        // 回合结束时恢复被封印的技能
        qizhang_seal: {
          temp: true,
          onRemove(player) {
            const seal = "qizhang_seal_" + player.playerid;
            for (const target of game.filterPlayer()) {
              if (target == player) continue;
              for (const sk in target.disabledSkills) {
                if (target.disabledSkills[sk].includes(seal)) {
                  target.enableSkill(sk);
                }
              }
            }
          }
        },
        // 梅花牌无次数限制
        qizhang_club: {
          temp: true,
          mod: {
            cardUsable(card, player, num) {
              if (get.suit(card) == "club") return Infinity;
            }
          }
        },
        // ========== 华 ==========
        hua: {
          audio: 2,
          trigger: { player: "useCardToPlayer" },
          filter(event, player) {
            return event.card.name == "sha" && event.isFirstTarget && player.maxHp > 1;
          },
          prompt: "是否发动【华】，减1点体力上限，此杀伤害+1且指定其他所有角色为目标？",
          async content(event, trigger, player) {
            await player.loseMaxHp(1);
            // 增加此杀的基础伤害（useCard 事件）
            const useCardEvent = trigger.getParent();
            if (typeof useCardEvent.baseDamage !== "number") {
              useCardEvent.baseDamage = 1;
            }
            useCardEvent.baseDamage++;
            const targets = game.filterPlayer().filter(
              (p) => p != player && !trigger.targets.includes(p) && lib.filter.targetEnabled2(trigger.card, player, p)
            );
            if (targets.length) {
              player.line(targets);
              trigger.targets.addArray(targets);
            }
          }
        }
      },
      translate: {
        shicaozhi: "势曹植",
        shicaozhi_ab: "野心初露",
        jiushi: "酒诗",
        jiushi1: "酒诗",
        jiushi2: "酒诗",
        jiushi3: "酒诗",
        jiushi4: "酒诗",
        jiushi4_damage: "酒诗",
        qizhang: "七章",
        qizhang_seal: "七章",
        qizhang_club: "七章",
        hua: "华",
        jiushi_info:
          "①当你需要使用酒时，若你的武将牌正面朝上，你可以翻面，视为使用一张酒；<br>" +
          "②当你受到伤害后，若你的武将牌背面朝上且你未因此次伤害发动过酒诗，你可以翻面并视为使用一张酒；<br>" +
          "③当你翻面后，你获得牌堆中一张锦囊牌和一张基本牌；<br>" +
          "④当你造成伤害时，若你的武将牌背面朝上，你可以翻回正面，本回合你使用杀的伤害基数+1。",
        qizhang_info:
          "限定技，出牌阶段，你可以失去1点体力，本回合其他角色的技能全部失效，且你使用的梅花牌无次数限制。",
        hua_info:
          "当你使用杀指定目标时，你可以减1点体力上限，此杀伤害+1且指定其他所有角色为目标。"
      }
    };
    await game.import("character", pack);
    // 扩展 content 执行晚于 boot 的 loadCharacter 阶段，需手动注册角色包
    if (!lib.config.characters.includes("shicaozhi")) {
      lib.config.characters.push("shicaozhi");
    }
    loadCharacter(pack);
    // 包名与武将名相同，武将名翻译会被误存到 _character_config，这里直接补回
    lib.translate.shicaozhi = "势曹植";
  }
};
