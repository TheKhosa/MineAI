/**
 * Subagent System - Index
 * Export all subagent classes and manager
 */

const { BaseSubagent } = require('./base_subagent');
const { MiningSubagent } = require('./mining_subagent');
const { CombatSubagent } = require('./combat_subagent');
const { ExplorationSubagent } = require('./exploration_subagent');
const { CraftingSubagent } = require('./crafting_subagent');
const { SubagentManager } = require('./subagent_manager');

module.exports = {
    BaseSubagent,
    MiningSubagent,
    CombatSubagent,
    ExplorationSubagent,
    CraftingSubagent,
    SubagentManager
};
