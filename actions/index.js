/**
 * Action Modules Index
 * Loads and exports all action module classes
 */

const InventoryActions = require('./inventory');
const CraftingActions = require('./crafting');
const ContainerActions = require('./container');
const EnchantingActions = require('./enchanting');
const TradingActions = require('./trading');
const AgricultureActions = require('./agriculture');
const RedstoneActions = require('./redstone');
const BedActions = require('./bed');
const CombatAdvancedActions = require('./combat_advanced');
const NavigationActions = require('./navigation');
const OptimizationActions = require('./optimization');
const CommunicationActions = require('./communication');

module.exports = {
    InventoryActions,
    CraftingActions,
    ContainerActions,
    EnchantingActions,
    TradingActions,
    AgricultureActions,
    RedstoneActions,
    BedActions,
    CombatAdvancedActions,
    NavigationActions,
    OptimizationActions,
    CommunicationActions
};
