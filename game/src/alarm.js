import {
  ALARM_DECAY, LOCKDOWN_DECAY, LASER_PENALTY, LOCKDOWN_SECONDS, HIDE_SECONDS,
} from './config.js';

export function makeAlarm() {
  return {
    value: 0,
    tripped: false,
    lockdownT: 0,
    maxValue: 0,
    everSeen: false,
    hiddenT: 0,
    recovering: false,
    seenThisStep: false,
    trips: 0,

    tripIfFull() {
      this.value = Math.max(0, Math.min(100, this.value));
      this.maxValue = Math.max(this.maxValue, this.value);
      if (this.value >= 100 && !this.tripped) {
        this.tripped = true;
        this.recovering = false;
        this.lockdownT = LOCKDOWN_SECONDS;
        this.hiddenT = 0;
        this.trips++;
      }
    },

    sight(dt, rate) {
      this.everSeen = true;
      this.seenThisStep = true;
      this.hiddenT = 0;
      if (this.tripped) {
        this.recovering = false;
        this.value = 100;
      } else {
        this.value += dt * rate;
      }
      this.tripIfFull();
    },

    laserHit() {
      this.value += LASER_PENALTY;
      this.hiddenT = 0;
      if (this.tripped) {
        this.value = 100;
        this.recovering = false;
      }
      this.tripIfFull();
    },

    update(dt, hiddenForLong = false) {
      this.lockdownT = Math.max(0, this.lockdownT - dt);
      if (!this.seenThisStep) {
        this.hiddenT += dt;
        if (this.tripped) {
          if (this.hiddenT >= HIDE_SECONDS || hiddenForLong) this.recovering = true;
          this.value = this.recovering ? Math.max(0, this.value - LOCKDOWN_DECAY * dt) : 100;
          if (this.value <= 0) {
            this.tripped = false;
            this.recovering = false;
          }
        } else {
          this.value = Math.max(0, this.value - ALARM_DECAY * dt);
        }
      }
      this.tripIfFull();
      this.seenThisStep = false;
    },
  };
}
