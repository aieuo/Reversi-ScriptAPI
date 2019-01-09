let system = server.registerSystem(0,0);

let query = {};

let task = {task: false, count: 0};

const score_list = [
	[ 30,-12,  0, -1, -1,  0,-12, 30],
	[-12,-15, -3, -3, -3, -3,-15,-12],
	[  0, -3,  0, -1, -1,  0, -3,  0],
	[  5, -3, -1, -1, -1, -1, -3,  5],
	[  5, -3, -1, -1, -1, -1, -3,  5],
	[  0, -3,  0, -1, -1,  0, -3,  0],
	[-12,-15, -3, -3, -3, -3,-15,-12],
	[ 30,-12,  0,  5,  5,  0,-12, 30]
];

const stone = {black: -1, white: 1, not_placed: 0};
const id = {name: "carpet", black: 15, white: 0};

let game = {turn: stone.black, count: 0};

let board = [
	[0, 0, 0, 0, 0, 0, 0, 0],
	[0, 0, 0, 0, 0, 0, 0, 0],
	[0, 0, 0, 0, 0, 0, 0, 0],
	[0, 0, 0,-1, 1, 0, 0, 0],
	[0, 0, 0, 1,-1, 0, 0, 0],
	[0, 0, 0, 0, 0, 0, 0, 0],
	[0, 0, 0, 0, 0, 0, 0, 0],
	[0, 0, 0, 0, 0, 0, 0, 0]
];

system.initialize = function () {
	query = this.registerQuery();
    this.listenForEvent("othello:setup", (eventData) => this.setup(eventData));
}

system.setup = function(eventData) {
    this.broadcastEvent("minecraft:execute_command", "/fill 0 4 0 7 4 7 concrete 13");
    this.broadcastEvent("minecraft:execute_command", "/fill 0 5 0 7 5 7 air");
    this.broadcastEvent("minecraft:execute_command", `/setblock 3 5 3 ${id.name} ${id.black}`);
    this.broadcastEvent("minecraft:execute_command", `/setblock 4 5 4 ${id.name} ${id.black}`);
    this.broadcastEvent("minecraft:execute_command", `/setblock 3 5 4 ${id.name} ${id.white}`);
    this.broadcastEvent("minecraft:execute_command", `/setblock 4 5 3 ${id.name} ${id.white}`);
    this.broadcastEvent("minecraft:execute_command", "/tp @p 3 5 3");
}

system.update = function() {
	const entities = this.getEntitiesFromQuery(query);
	const count = entities.length;
	for(let i = 0; i < count; i ++) {
		if(entities[i].__identifier__ !== "minecraft:endermite") continue;

		const pos = this.createComponent(entities[i], "minecraft:position");
		const x = Math.floor(pos.x);
		const y = Math.floor(pos.y);
		const z = Math.floor(pos.z);
		this.destroyEntity(entities[i]);

		if(game.turn !== stone.black) {
			this.broadcastEvent("minecraft:display_chat_event", "相手の番です");
			break;
		}

		if(!this.isOnBoard(x, y, z) || this.getAdjacentStones(x, z, stone.black).length <= 0) {
			this.broadcastEvent("minecraft:display_chat_event", "その場所には置けません");
			break;
		}

		const blocks = this.getAdjacentStones(x, z, stone.black);
		const size = blocks.length;
		let placed = false;
		for(let i = 0; i < size; i ++) {
			const count = this.getFlippableStoneCount(x, z, blocks[i].x - x, blocks[i].z - z, stone.black);
			if(count <= 0) continue;
			placed = this.flipStones(x, z, blocks[i].x - x, blocks[i].z - z, count, stone.black);
		}

		if(!placed) {
			this.broadcastEvent("minecraft:display_chat_event", "その場所には置けません");
			break;
		}

		game.count ++;
		if(game.count >= 60) {
			this.finish();
			break;
		}
		game.turn *= -1;

		// 10tick後にcpuがブロックを置く場所を探す
		task.count = 10;
		task.task = true;
	}
	if(task.task) {
		task.count --;
		if(task.count == 0) {
			this.findPlace(stone.white);
			task.task = false;
		}
	}
}

system.isOnBoard = function(x, y, z) {
	return y === 5 && x >= 0 && x <= 8 && z >= 0 && z <= 8;
}

system.getAdjacentStones = function(x, z, turn) {
	let result = [];
	if(board[x][z] !== stone.not_placed) return result;

    for(let i = x-1; i <= x+1; i ++){
        for(let j = z-1; j <= z+1; j ++){
			if(!(i in board && j in board[i])) continue;
            if(board[i][j] === -turn) result.push({x: i, z: j});
        }
    }
    return result;
}

system.getFlippableStoneCount = function(x, z, dx, dz, turn) {
	let count = 0;
	let found_own_stone = false;
	for(let i = 0; i < 8; i ++) {
		x += dx;
		z += dz;
		if(!(x in board && z in board[x])) break;
		if(board[x][z] === turn) found_own_stone = true;
		if(board[x][z] === turn || board[x][z] === stone.not_placed) break;
		count ++;
	}
	if(!found_own_stone) count = 0;
	return count;
}

system.flipStones = function(x, z, dx, dz, count, turn) {
	for(let i = 0; i <= count; i ++) {
		const damage = turn === stone.black ? id.black : id.white;
		if(x in board && z in board[x]) {
			board[x][z] = turn;
	    	this.broadcastEvent("minecraft:execute_command", `/setblock ${x} 5 ${z} ${id.name} ${damage}`);
	    }
		x += dx;
		z += dz;
	}
	return true;
}

system.getScore = function(turn, board1 = null) {
	if(board1 === null) board1 = board;
	let score = 0;
	for(let x = 0; x <= 7; x ++) {
		for(let z = 0; z <= 7; z ++) {
			if(board1[x][z] === turn) {
				score += score_list[x][z];
			}
		}
	}
	return score;
}

system.findPlace = function(turn) {
	let max = -9999;
	let max_pos = {};
	for(let x = 0; x <= 7; x ++) {
		for(let z = 0; z <= 7; z ++) {
			const stones = this.getAdjacentStones(x, z, turn);
			const size = stones.length;
			if(size === 0) continue;

			let replaced = false;
			let board_ai = JSON.parse(JSON.stringify(board));
			for(let i = 0; i < size; i ++) {
				const count = this.getFlippableStoneCount(x, z, stones[i].x - x, stones[i].z - z, turn);
				if(count <= 0) continue;

				for(let j = 0; j <= count; j ++) {
					replaced = true;
					board_ai[x + ((stones[i].x - x) * j)][z + ((stones[i].z - z) * j)] = turn;
				}
			}
			if(!replaced) continue;
			const score = this.getScore(turn, board_ai);
			if(score > max) {
				max = score;
				max_pos.x = x;
				max_pos.z = z;
			}
		}
	}
	if(max === -9999) {
		this.broadcastEvent("minecraft:display_chat_event", "相手は置ける場所がないのでパスしました、あなたの番です");
		game.turn *= -1;
		return;
	}

	let blocks = this.getAdjacentStones(max_pos.x, max_pos.z, turn);
	let size = blocks.length;
	for(let k = 0; k < size; k ++) {
		let count = this.getFlippableStoneCount(max_pos.x, max_pos.z, blocks[k].x - max_pos.x, blocks[k].z - max_pos.z, turn);
		if(count <= 0) continue;
		this.flipStones(max_pos.x, max_pos.z, blocks[k].x - max_pos.x, blocks[k].z - max_pos.z, count, turn);
	}
	game.count ++;
	if(game.count >= 60) {
		this.finish();
		return;
	}
	if(this.isPass(turn * -1)) {
		this.broadcastEvent("minecraft:display_chat_event", "置ける場所がありません、パスしました");
		if(this.isPass(turn)) {
			this.broadcastEvent("minecraft:display_chat_event", "相手も置ける場所がありません");
			this.finish();
			return;
		}
		this.findPlace(stone.white);
		return;
	}
	this.broadcastEvent("minecraft:display_chat_event", "あなたの番です");
	game.turn *= -1;
}

system.isPass = function(turn) {
	let total = 0;
	for(let x = 0; x <= 7; x ++) {
		for(let z = 0; z <= 7; z ++) {
			const stones = this.getAdjacentStones(x, z, turn);
			const size = stones.length;
			if(size === 0) continue;

			for(let i = 0; i < size; i ++) {
				total += this.getFlippableStoneCount(x, z, stones[i].x - x, stones[i].z - z, turn);
			}
		}
	}
	return total <= 0;
}

system.finish = function() {
	let black = 0;
	let white = 0;
	for(let x = 0; x <= 7; x ++) {
		for(let z = 0; z <= 7; z ++) {
			if(board[x][z] === stone.black) black ++;
			if(board[x][z] === stone.white) white ++;
		}
	}
	let score = this.getScore(stone.black) + 500;
	if(black > white) {
		this.broadcastEvent("minecraft:display_chat_event", `§l§a${black}対${white}であなたの勝ちです score:${score}`);
	} else if(black === white) {
		this.broadcastEvent("minecraft:display_chat_event", `§l§a${black}対${white}で引き分けです score:${score}`);
	} else {
		this.broadcastEvent("minecraft:display_chat_event", `§l§a${black}対${white}であなたの負けです score:${score}`);
	}
}