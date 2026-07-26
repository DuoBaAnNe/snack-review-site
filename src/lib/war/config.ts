// Tunable balance constants for the province battle game.
// Tweak these after playtesting to adjust pacing/difficulty.
export const WAR = {
    BASE_GARRISON: 10,        // starting garrison of every territory each season
    REINFORCE_PER_LIKE: 5,    // garrison added to each of the faction's territories per like
    APPLY_STEPS_PER_LIKE: 1,  // how many combat steps one like triggers
    BASE_DEFENSE: 4,          // flat defensive bonus so weak/empty provinces resist a bit
    ATTACK_ADVANTAGE: 1.6,    // must outnumber the defended position by this to attack
                              // (keeps conquered land defensible vs equal-strength neighbors)
    CASUALTY_RATE: 0.8,       // attacker losses on a win ≈ defender size × this
    OCCUPY_RATE: 0.4,         // share of surviving attackers left to garrison the new land
    REPEL_ATK_LOSS: 0.5,      // fraction of the defender's size the attacker loses when repelled
    REPEL_DEF_LOSS: 0.25,     // fraction of the attacker's size the defender loses when repelled
    RAND_MIN: 0.85,           // combat randomness lower bound
    RAND_MAX: 1.15,           // combat randomness upper bound
    WAR_LOG_KEEP: 50,         // how many recent battle-log rows to retain
    SEASON_DAYS: 7,           // season length
} as const;
