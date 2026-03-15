/**
 * Core type definitions for the World Evolution Simulation
 */
export var EventType;
(function (EventType) {
    EventType["NATURAL"] = "natural";
    EventType["SOCIAL"] = "social";
    EventType["CONFLICT"] = "conflict";
    EventType["TECHNOLOGICAL"] = "technological";
    EventType["MIGRATION"] = "migration";
    EventType["CULTURAL"] = "cultural";
})(EventType || (EventType = {}));
export var LocationType;
(function (LocationType) {
    LocationType["CAVE"] = "cave";
    LocationType["SETTLEMENT"] = "settlement";
    LocationType["CITY"] = "city";
    LocationType["DUNGEON"] = "dungeon";
    LocationType["FORTRESS"] = "fortress";
    LocationType["TEMPLE"] = "temple";
    LocationType["VILLAGE"] = "village";
    LocationType["TRADE_POST"] = "trade_post";
    LocationType["RUINS"] = "ruins";
    LocationType["LANDMARK"] = "landmark";
})(LocationType || (LocationType = {}));
export var TerrainType;
(function (TerrainType) {
    TerrainType["PLAINS"] = "plains";
    TerrainType["MOUNTAINS"] = "mountains";
    TerrainType["FOREST"] = "forest";
    TerrainType["DESERT"] = "desert";
    TerrainType["SWAMP"] = "swamp";
    TerrainType["HILLS"] = "hills";
    TerrainType["COASTAL"] = "coastal";
    TerrainType["TUNDRA"] = "tundra";
    TerrainType["JUNGLE"] = "jungle";
})(TerrainType || (TerrainType = {}));
export var Resource;
(function (Resource) {
    Resource["IRON"] = "iron";
    Resource["GOLD"] = "gold";
    Resource["SILVER"] = "silver";
    Resource["COPPER"] = "copper";
    Resource["WOOD"] = "wood";
    Resource["STONE"] = "stone";
    Resource["FOOD"] = "food";
    Resource["WATER"] = "water";
    Resource["MAGIC"] = "magic";
    Resource["GEMS"] = "gems";
})(Resource || (Resource = {}));
//# sourceMappingURL=index.js.map