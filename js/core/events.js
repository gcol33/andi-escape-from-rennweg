/**
 * Andi VN - Event Types
 * @module core/events
 *
 * Centralized event type constants for type-safe event handling.
 * Use these constants instead of string literals for events.
 *
 * Usage:
 *   eventBus.on(Events.BATTLE_START, function(data) { ... });
 *   eventBus.emit(Events.BATTLE_START, { enemy: enemyData });
 */

(function() {
'use strict';

/**
 * Scene lifecycle events
 * @readonly
 * @type {Object}
 */
var SceneEvents = {
    /** Emitted when entering a new scene */
    ENTER: 'scene:enter',
    /** Emitted when exiting a scene */
    EXIT: 'scene:exit',
    /** Emitted when advancing to next text block */
    BLOCK_ADVANCE: 'scene:block:advance',
    /** Emitted when all text blocks have been shown */
    BLOCK_COMPLETE: 'scene:block:complete',
    /** Emitted when a choice is selected */
    CHOICE_SELECTED: 'scene:choice:selected',
    /** Emitted when scene is ready to show choices */
    CHOICES_READY: 'scene:choices:ready',
    /** Emitted when an action is about to execute */
    ACTION_START: 'scene:action:start',
    /** Emitted when an action completes */
    ACTION_COMPLETE: 'scene:action:complete'
};

/**
 * Battle lifecycle events
 * @readonly
 * @type {Object}
 */
var BattleEvents = {
    /** Emitted when battle starts */
    START: 'battle:start',
    /** Emitted when battle ends (win/lose/flee) */
    END: 'battle:end',
    /** Emitted at the start of each turn */
    TURN_START: 'battle:turn:start',
    /** Emitted at the end of each turn */
    TURN_END: 'battle:turn:end',
    /** Emitted when phase changes (intro, player, enemy, animating, ended) */
    PHASE_CHANGE: 'battle:phase:change',
    /** Emitted when any action is taken */
    ACTION: 'battle:action',
    /** Emitted when damage is dealt */
    DAMAGE: 'battle:damage',
    /** Emitted when healing occurs */
    HEAL: 'battle:heal',
    /** Emitted when a status effect is applied */
    STATUS_APPLIED: 'battle:status:applied',
    /** Emitted when a status effect expires */
    STATUS_EXPIRED: 'battle:status:expired',
    /** Emitted when enemy intent is telegraphed */
    INTENT_SHOWN: 'battle:intent:shown',
    /** Emitted when barrier state changes */
    BARRIER_CHANGE: 'battle:barrier:change',
    /** Emitted when stagger threshold reached */
    STAGGER_BREAK: 'battle:stagger:break',
    /** Emitted when victory animation should play */
    VICTORY: 'battle:victory',
    /** Emitted when defeat animation should play */
    DEFEAT: 'battle:defeat'
};

/**
 * QTE lifecycle events
 * @readonly
 * @type {Object}
 */
var QTEEvents = {
    /** Emitted when QTE starts */
    START: 'qte:start',
    /** Emitted when player provides input */
    INPUT: 'qte:input',
    /** Emitted when QTE completes with result */
    RESULT: 'qte:result',
    /** Emitted when QTE is cancelled */
    CANCEL: 'qte:cancel',
    /** Emitted on each tick for animation updates */
    TICK: 'qte:tick'
};

/**
 * Quiz events
 * @readonly
 * @type {Object}
 */
var QuizEvents = {
    /** Emitted when quiz starts */
    START: 'quiz:start',
    /** Emitted when answer is selected */
    ANSWER: 'quiz:answer',
    /** Emitted when timer ticks */
    TICK: 'quiz:tick',
    /** Emitted when quiz ends */
    END: 'quiz:end'
};

/**
 * Audio events
 * @readonly
 * @type {Object}
 */
var AudioEvents = {
    /** Emitted to play background music */
    MUSIC_PLAY: 'audio:music:play',
    /** Emitted to stop background music */
    MUSIC_STOP: 'audio:music:stop',
    /** Emitted to pause background music */
    MUSIC_PAUSE: 'audio:music:pause',
    /** Emitted to resume background music */
    MUSIC_RESUME: 'audio:music:resume',
    /** Emitted to play a sound effect */
    SFX_PLAY: 'audio:sfx:play',
    /** Emitted when mute state changes */
    MUTE_CHANGE: 'audio:mute:change',
    /** Emitted when volume changes */
    VOLUME_CHANGE: 'audio:volume:change'
};

/**
 * State events
 * @readonly
 * @type {Object}
 */
var StateEvents = {
    /** Emitted when any state property changes */
    CHANGED: 'state:changed',
    /** Emitted when state is loaded from save */
    LOADED: 'state:loaded',
    /** Emitted when state is reset */
    RESET: 'state:reset',
    /** Emitted before save to localStorage */
    SAVING: 'state:saving',
    /** Emitted after save completes */
    SAVED: 'state:saved'
};

/**
 * UI events
 * @readonly
 * @type {Object}
 */
var UIEvents = {
    /** Emitted when typewriter effect completes */
    TYPEWRITER_COMPLETE: 'ui:typewriter:complete',
    /** Emitted when typewriter is skipped */
    TYPEWRITER_SKIP: 'ui:typewriter:skip',
    /** Emitted when scene transition starts */
    TRANSITION_START: 'ui:transition:start',
    /** Emitted when scene transition ends */
    TRANSITION_END: 'ui:transition:end',
    /** Emitted when inventory display toggles */
    INVENTORY_TOGGLE: 'ui:inventory:toggle',
    /** Emitted when dev mode toggles */
    DEV_MODE_TOGGLE: 'ui:devmode:toggle',
    /** Emitted when theme changes */
    THEME_CHANGE: 'ui:theme:change'
};

/**
 * Input events (from InputController)
 * @readonly
 * @type {Object}
 */
var InputEvents = {
    /** Emitted when player requests advance (space/click) */
    ADVANCE: 'input:advance',
    /** Emitted when player selects a choice */
    CHOICE: 'input:choice',
    /** Emitted when player confirms QTE input */
    QTE_CONFIRM: 'input:qte:confirm',
    /** Emitted when player selects battle action */
    BATTLE_ACTION: 'input:battle:action',
    /** Emitted when player requests skip typewriter */
    SKIP_TYPEWRITER: 'input:skip-typewriter'
};

/**
 * Inventory events
 * @readonly
 * @type {Object}
 */
var InventoryEvents = {
    /** Emitted when item is added */
    ITEM_ADDED: 'inventory:item:added',
    /** Emitted when item is removed */
    ITEM_REMOVED: 'inventory:item:removed',
    /** Emitted when item is used */
    ITEM_USED: 'inventory:item:used'
};

/**
 * All events combined for convenience
 * @type {Object}
 */
var Events = {
    // Scene
    SCENE_ENTER: SceneEvents.ENTER,
    SCENE_EXIT: SceneEvents.EXIT,
    BLOCK_ADVANCE: SceneEvents.BLOCK_ADVANCE,
    BLOCK_COMPLETE: SceneEvents.BLOCK_COMPLETE,
    CHOICE_SELECTED: SceneEvents.CHOICE_SELECTED,
    CHOICES_READY: SceneEvents.CHOICES_READY,
    ACTION_START: SceneEvents.ACTION_START,
    ACTION_COMPLETE: SceneEvents.ACTION_COMPLETE,

    // Battle
    BATTLE_START: BattleEvents.START,
    BATTLE_END: BattleEvents.END,
    BATTLE_TURN_START: BattleEvents.TURN_START,
    BATTLE_TURN_END: BattleEvents.TURN_END,
    BATTLE_PHASE_CHANGE: BattleEvents.PHASE_CHANGE,
    BATTLE_ACTION: BattleEvents.ACTION,
    BATTLE_DAMAGE: BattleEvents.DAMAGE,
    BATTLE_HEAL: BattleEvents.HEAL,
    BATTLE_STATUS_APPLIED: BattleEvents.STATUS_APPLIED,
    BATTLE_STATUS_EXPIRED: BattleEvents.STATUS_EXPIRED,
    BATTLE_INTENT_SHOWN: BattleEvents.INTENT_SHOWN,
    BATTLE_BARRIER_CHANGE: BattleEvents.BARRIER_CHANGE,
    BATTLE_STAGGER_BREAK: BattleEvents.STAGGER_BREAK,
    BATTLE_VICTORY: BattleEvents.VICTORY,
    BATTLE_DEFEAT: BattleEvents.DEFEAT,

    // QTE
    QTE_START: QTEEvents.START,
    QTE_INPUT: QTEEvents.INPUT,
    QTE_RESULT: QTEEvents.RESULT,
    QTE_CANCEL: QTEEvents.CANCEL,
    QTE_TICK: QTEEvents.TICK,

    // Quiz
    QUIZ_START: QuizEvents.START,
    QUIZ_ANSWER: QuizEvents.ANSWER,
    QUIZ_TICK: QuizEvents.TICK,
    QUIZ_END: QuizEvents.END,

    // Audio
    AUDIO_MUSIC_PLAY: AudioEvents.MUSIC_PLAY,
    AUDIO_MUSIC_STOP: AudioEvents.MUSIC_STOP,
    AUDIO_MUSIC_PAUSE: AudioEvents.MUSIC_PAUSE,
    AUDIO_MUSIC_RESUME: AudioEvents.MUSIC_RESUME,
    AUDIO_SFX_PLAY: AudioEvents.SFX_PLAY,
    AUDIO_MUTE_CHANGE: AudioEvents.MUTE_CHANGE,
    AUDIO_VOLUME_CHANGE: AudioEvents.VOLUME_CHANGE,

    // State
    STATE_CHANGED: StateEvents.CHANGED,
    STATE_LOADED: StateEvents.LOADED,
    STATE_RESET: StateEvents.RESET,
    STATE_SAVING: StateEvents.SAVING,
    STATE_SAVED: StateEvents.SAVED,

    // UI
    UI_TYPEWRITER_COMPLETE: UIEvents.TYPEWRITER_COMPLETE,
    UI_TYPEWRITER_SKIP: UIEvents.TYPEWRITER_SKIP,
    UI_TRANSITION_START: UIEvents.TRANSITION_START,
    UI_TRANSITION_END: UIEvents.TRANSITION_END,
    UI_INVENTORY_TOGGLE: UIEvents.INVENTORY_TOGGLE,
    UI_DEV_MODE_TOGGLE: UIEvents.DEV_MODE_TOGGLE,
    UI_THEME_CHANGE: UIEvents.THEME_CHANGE,

    // Input
    INPUT_ADVANCE: InputEvents.ADVANCE,
    INPUT_CHOICE: InputEvents.CHOICE,
    INPUT_QTE_CONFIRM: InputEvents.QTE_CONFIRM,
    INPUT_BATTLE_ACTION: InputEvents.BATTLE_ACTION,
    INPUT_SKIP_TYPEWRITER: InputEvents.SKIP_TYPEWRITER,

    // Inventory
    INVENTORY_ITEM_ADDED: InventoryEvents.ITEM_ADDED,
    INVENTORY_ITEM_REMOVED: InventoryEvents.ITEM_REMOVED,
    INVENTORY_ITEM_USED: InventoryEvents.ITEM_USED
};

// Global exports
window.Events = Events;
window.SceneEvents = SceneEvents;
window.BattleEvents = BattleEvents;
window.QTEEvents = QTEEvents;
window.QuizEvents = QuizEvents;
window.AudioEvents = AudioEvents;
window.StateEvents = StateEvents;
window.UIEvents = UIEvents;
window.InputEvents = InputEvents;
window.InventoryEvents = InventoryEvents;

})();
