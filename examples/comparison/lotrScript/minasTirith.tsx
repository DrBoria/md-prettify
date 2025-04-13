class MinasTirith {
  public defenders: string[];      // Vanguard: Public array of defenders
  private reserves: string[];      // Rearguard: Private array of reserves
  public wallStrength: number;     // Wall strength of the city
  public gatesOpen: boolean;       // Status of the gates (open or closed)

  constructor(defenders: string[], reserves: string[], wallStrength: number) {
      this.defenders = defenders;
      this.reserves = reserves;
      this.wallStrength = wallStrength;
      this.gatesOpen = false;      // Gates start closed
  }

  public defend(mordor: Mordor): void {
      let counterDamage: number = 50; // Base counter damage
      if (this.defenders.includes("Aragorn")) {
          console.log("Aragorn rallies the defenders!");
          counterDamage += 20;        // Bonus damage with Aragorn
      }
      if (this.wallStrength < 10 && this.defenders.includes("Gandalf")) {
          console.log("Gandalf makes a final stand: 'You shall not pass!'");
          counterDamage += 100;       // Significant damage during last stand
      }
      console.log(`Minas Tirith counterattacks with strength: ${counterDamage}`);
      mordor.armySize -= counterDamage;
  }
}

class Mordor {
  public attackers: string[];      // Vanguard: Public array of attackers
  private support: string[];       // Rearguard: Private array of support forces
  public armySize: number;         // Size of Mordor's army
  public hasBalrog: boolean;       // Indicates if a Balrog is present

  constructor(attackers: string[], support: string[], armySize: number, hasBalrog: boolean) {
      this.attackers = attackers;
      this.support = support;
      this.armySize = armySize;
      this.hasBalrog = hasBalrog;
  }

  public attack(target: MinasTirith): void {
      let damage: number = 10;     // Base damage
      if (this.attackers.includes("Witch-king")) {
          console.log("The Witch-king leads the assault with terror!");
          damage += 5;             // Bonus damage from Witch-king
      }
      if (this.hasBalrog) {
          console.log("The Balrog advances!");
          if (target.defenders.includes("Gandalf")) {
              console.log("Gandalf confronts the Balrog: 'You shall not pass!'");
              this.hasBalrog = false; // Balrog is defeated
          } else {
              console.log("The Balrog wreaks havoc!");
              damage += 20;        // Extra damage if Balrog is unopposed
          }
      }
      console.log(`Mordor attacks with damage: ${damage}`);
      target.wallStrength -= damage;
      if (target.wallStrength < 0) {
          console.log("The walls of Minas Tirith crumble!");
      }
  }
}

function stormMinasTirith(mordor: Mordor, minasTirith: MinasTirith): void {
  console.log("The battle for Minas Tirith begins!");
  let battleContinues: boolean = true;
  while (battleContinues && minasTirith.wallStrength > 0 && mordor.armySize > 0) {
      mordor.attack(minasTirith);
      if (minasTirith.wallStrength <= 0) {
          console.log("Minas Tirith’s defenses are breached!");
          battleContinues = false;
      } else {
          minasTirith.defend(mordor);
          if (mordor.armySize <= 0) {
              console.log("Mordor’s forces are depleted!");
              battleContinues = false;
          }
      }
  }
  if (minasTirith.wallStrength <= 0) {
      console.log("Minas Tirith has fallen to the shadow!");
  } else if (mordor.armySize <= 0) {
      console.log("Mordor is defeated! Minas Tirith endures!");
  } else {
      console.log("The battle ends in a stalemate.");
  }
}

// Initialize the forces
const minasTirith = new MinasTirith(
  ["Gandalf", "Aragorn", "Legolas"],    // Defenders (vanguard)
  ["Faramir", "Boromir"],               // Reserves (rearguard)
  100                                   // Initial wall strength
);

const mordor = new Mordor(
  ["Witch-king", "Nazgul", "Orcs"],    // Attackers (vanguard)
  ["Trolls", "Uruk-hai"],              // Support (rearguard)
  1000,                                // Initial army size
  true                                 // Balrog is present
);

// Start the simulation
console.log("The armies gather before the white city.");
stormMinasTirith(mordor, minasTirith);
