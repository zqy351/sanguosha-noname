import { game, get, lib, ui, _status } from "noname";
import { loadCharacter } from "../../noname/init/loading.js";

// 自定义武将：势曹植（魏，4体力）—— 酒诗 / 七章 / 华
// 注意：技能名加 scz_ 前缀，避免与官方一将成名曹植的 jiushi/jiushi1/jiushi3 重名冲突
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
          skills: ["scz_jiushi", "qizhang", "hua"]
        }
      },
      skill: {
        // ========== 酒诗（势曹植） ==========
        scz_jiushi: {
          audio: 2,
          group: ["scz_jiushi_use", "scz_jiushi_turnback", "scz_jiushi_gain", "scz_jiushi_damage"]
        },
        // ① 需要使用酒时，正面朝上：翻面视为使用一张酒
        scz_jiushi_use: {
          hiddenCard(player, name) {
            if (name == "jiu") return !player.isTurnedOver();
            return false;
          },
          audio: "jiushi",
          enable: "chooseToUse",
          sourceSkill: "scz_jiushi",
          filter(event, player) {
            if (player.isTurnedOver()) return false;
            return event.filterCard({ name: "jiu", isCard: true }, player, event);
          },
          async content(event, trigger, player) {
            if (_status.event.getParent(2).type == "dying") {
              event.dying = player;
              event.type = "dying";
            }
            await player.turnOver();
            await player.useCard({ name: "jiu", isCard: true }, player);
          }
        },
        // ② 受到伤害后，背面朝上且未因此次伤害发动过酒诗：翻面并视为使用一张酒
        scz_jiushi_turnback: {
          audio: "jiushi",
          trigger: { player: "damageEnd" },
          sourceSkill: "scz_jiushi",
          filter(event, player) {
            if (!player.isTurnedOver()) return false;
            if (player.hasHistory("useCard", (evt) => {
              if (evt.card.name != "jiu" || evt.getParent().name != "scz_jiushi_use") return false;
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
        scz_jiushi_gain: {
          audio: "jiushi",
          trigger: { player: "turnOverAfter" },
          sourceSkill: "scz_jiushi",
          forced: true,
          async content(event, trigger, player) {
            const trick = get.cardPile2((card) => get.type2(card) == "trick", "random");
            const basic = get.cardPile2((card) => get.type2(card) == "basic", "random");
            const cards = [trick, basic].filter(Boolean);
            if (cards.length) await player.gain(cards, "gain2", "log");
          }
        },
        // ④ 造成伤害时，背面朝上：翻回正面，本回合杀伤害基数+1
        scz_jiushi_damage: {
          audio: "jiushi",
          trigger: { source: "damageBegin1" },
          sourceSkill: "scz_jiushi",
          filter(event, player) {
            return player.isTurnedOver() && event.card?.name == "sha";
          },
          prompt: "是否发动【酒诗】，翻回正面，本回合杀伤害基数+1？",
          async content(event, trigger, player) {
            // 直接切换翻面 class（避免在 trigger 阶段嵌套 turnOver 事件造成队列死锁）
            if (player.isTurnedOver()) {
              player.classList.remove("turnedover");
              if (player.update) player.update();
            }
            // 本次伤害 +1
            trigger.num++;
            // 本回合内后续杀伤害基数 +1（useCard 时 baseDamage++）
            player.addTempSkill("scz_jiushi_damage_buff", "phaseAfter");
          }
        },
        scz_jiushi_damage_buff: {
          temp: true,
          trigger: { source: "useCard" },
          filter(event, player) {
            return event.card?.name == "sha";
          },
          forced: true,
          content() {
            trigger.baseDamage++;
            game.log("势曹植的【酒诗】使", trigger.card, "的伤害值基数+1");
          }
        },
        // ========== 七章（限定技） ==========
        qizhang: {
          audio: 2,
          limited: true,
          enable: "phaseUse",
          usable: 1,
          skillAnimation: true,
          animationColor: "wood",
          contentBefore(event, trigger, player) {
            player.awakenSkill(event.skill);
          },
          filter(event, player) {
            return player.hp > 1;
          },
          async content(event, trigger, player) {
            await player.loseHp(1);
            // 本回合其他角色技能失效（tempBanSkill 会连带 group 子技能一并失效）
            for (const target of game.filterPlayer()) {
              if (target == player) continue;
              for (const sk of target.getSkills()) {
                target.tempBanSkill(sk, "forever");
              }
            }
            // 势曹植回合结束（phaseAfter）时统一解除封印
            player.addTempSkill(["qizhang_unseal", "qizhang_club"], "phaseAfter");
          }
        },
        qizhang_unseal: {
          temp: true,
          onremove(player) {
            for (const target of game.filterPlayer()) {
              if (target == player) continue;
              for (const key of Object.keys(target.storage)) {
                if (key.startsWith("temp_ban_") && target.storage[key] === true) {
                  delete target.storage[key];
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
        scz_jiushi: "酒诗",
        scz_jiushi_use: "酒诗",
        scz_jiushi_turnback: "酒诗",
        scz_jiushi_gain: "酒诗",
        scz_jiushi_damage: "酒诗",
        scz_jiushi_damage_buff: "酒诗",
        qizhang: "七章",
        qizhang_unseal: "七章",
        qizhang_club: "七章",
        hua: "华",
        scz_jiushi_info:
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
