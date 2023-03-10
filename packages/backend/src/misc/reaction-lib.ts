import { emojiRegex } from "./emoji-regex.js";
import { fetchMeta } from "./fetch-meta.js";
import { Emojis } from "@/models/index.js";
import { toPunyNullable } from "./convert-host.js";
import { IsNull } from "typeorm";

const legacies: Record<string, string> = {
	like: "đ",
	love: "â€ïž", // ăăă«èšèż°ăăć ŽćăŻç°äœć­ă»ăŹăŻăżăć„ăăȘă <- not that good because modern browsers just display it as the red heart so just convert it to it to not end up with two seperate reactions of "the same emoji" for the user
	laugh: "đ",
	hmm: "đ€",
	surprise: "đź",
	congrats: "đ",
	angry: "đą",
	confused: "đ„",
	rip: "đ",
	pudding: "đź",
	star: "â­",
};

export async function getFallbackReaction(): Promise<string> {
	const meta = await fetchMeta();
	return meta.defaultReaction;
}

export function convertLegacyReactions(reactions: Record<string, number>) {
	const _reactions = {} as Record<string, number>;

	for (const reaction of Object.keys(reactions)) {
		if (reactions[reaction] <= 0) continue;

		if (Object.keys(legacies).includes(reaction)) {
			if (_reactions[legacies[reaction]]) {
				_reactions[legacies[reaction]] += reactions[reaction];
			} else {
				_reactions[legacies[reaction]] = reactions[reaction];
			}
		} else if (reaction === "â„ïž") {
			if (_reactions["â€ïž"]) {
				_reactions["â€ïž"] += reactions[reaction];
			} else {
				_reactions["â€ïž"] = reactions[reaction];
			}
		} else {
			if (_reactions[reaction]) {
				_reactions[reaction] += reactions[reaction];
			} else {
				_reactions[reaction] = reactions[reaction];
			}
		}
	}

	const _reactions2 = {} as Record<string, number>;

	for (const reaction of Object.keys(_reactions)) {
		_reactions2[decodeReaction(reaction).reaction] = _reactions[reaction];
	}

	return _reactions2;
}

export async function toDbReaction(
	reaction?: string | null,
	reacterHost?: string | null,
): Promise<string> {
	if (reaction == null) return await getFallbackReaction();

	reacterHost = toPunyNullable(reacterHost);

	// Convert string-type reactions to unicode
	if (Object.keys(legacies).includes(reaction)) return legacies[reaction];
	// Convert old heart to new
	if (reaction === "â„ïž") return "â€ïž";
	// Allow unicode reactions
	const match = emojiRegex.exec(reaction);
	if (match) {
		const unicode = match[0];
		return unicode;
	}

	const custom = reaction.match(/^:([\w+-]+)(?:@\.)?:$/);
	if (custom) {
		const name = custom[1];
		const emoji = await Emojis.findOneBy({
			host: reacterHost ?? IsNull(),
			name,
		});

		if (emoji) return reacterHost ? `:${name}@${reacterHost}:` : `:${name}:`;
	}

	return await getFallbackReaction();
}

type DecodedReaction = {
	/**
	 * ăȘăąăŻă·ă§ăłć (Unicode Emoji or ':name@hostname' or ':name@.')
	 */
	reaction: string;

	/**
	 * name (ă«ăčăżă ç””æć­ăźć Žćname, EmojiăŻăšăȘă«äœżă)
	 */
	name?: string;

	/**
	 * host (ă«ăčăżă ç””æć­ăźć Žćhost, EmojiăŻăšăȘă«äœżă)
	 */
	host?: string | null;
};

export function decodeReaction(str: string): DecodedReaction {
	const custom = str.match(/^:([\w+-]+)(?:@([\w.-]+))?:$/);

	if (custom) {
		const name = custom[1];
		const host = custom[2] || null;

		return {
			reaction: `:${name}@${host || "."}:`, // ă­ăŒă«ă«ćăŻ@ä»„éăçç„ăăăźă§ăŻăȘă.ă«ăă
			name,
			host,
		};
	}

	return {
		reaction: str,
		name: undefined,
		host: undefined,
	};
}

export function convertLegacyReaction(reaction: string): string {
	reaction = decodeReaction(reaction).reaction;
	if (Object.keys(legacies).includes(reaction)) return legacies[reaction];
	return reaction;
}
