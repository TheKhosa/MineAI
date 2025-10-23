/**
 * Action Modules Index
 * Loads and exports all action module classes
 * Total: 32 action modules, 410+ actions
 */

// ORIGINAL MODULES (12 modules, ~140 actions)
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

// ADVANCED MODULES - BATCH 1 (10 modules, ~125 actions)
const DimensionActions = require('./dimension');
const HotbarActions = require('./hotbar');
const CombatTimingActions = require('./combat_timing');
const VillagerTradingActions = require('./villager_trading');
const ToolManagementActions = require('./tool_management');
const StorageActions = require('./storage');
const VehicleActions = require('./vehicles');
const SpawnManagementActions = require('./spawn_management');
const FishingActions = require('./fishing');
const FlightActions = require('./flight');

// ESSENTIAL MODULES - BATCH 2 (10 modules, ~145 actions)
const HealthActions = require('./health');
const SocialActions = require('./social');
const PotionActions = require('./potion');
const ExplorationActions = require('./exploration');
const NeedsActions = require('./needs');
const ExperienceActions = require('./experience');
const MemoryActions = require('./memory');
const AchievementActions = require('./achievement');
const TeamActions = require('./team');
const WeatherActions = require('./weather');

module.exports = {
    // Original modules
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
    CommunicationActions,
    // Advanced modules (Batch 1)
    DimensionActions,
    HotbarActions,
    CombatTimingActions,
    VillagerTradingActions,
    ToolManagementActions,
    StorageActions,
    VehicleActions,
    SpawnManagementActions,
    FishingActions,
    FlightActions,
    // Essential modules (Batch 2)
    HealthActions,
    SocialActions,
    PotionActions,
    ExplorationActions,
    NeedsActions,
    ExperienceActions,
    MemoryActions,
    AchievementActions,
    TeamActions,
    WeatherActions
};
