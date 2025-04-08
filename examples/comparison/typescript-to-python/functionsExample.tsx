function processOrder<T>(seed: string, qty: number, vip: boolean, zone: string): void {
    try {
        if (qty > 0) {
            switch (seed) {
                case "corn":
                    if (zone === "east") {
                        if (vip) {
                            console.log(`Corn VIP: ${calcPrice(seed, qty)}`);
                        } else {
                            console.log("Corn non-VIP");
                        }
                    } else {
                        console.log("Wrong zone");
                    }
                    break;
                case "wheat":
                    if (zone === "west" && qty > 5) {
                        if (vip) {
                            try {
                                console.log(`Wheat VIP: ${calcPrice(seed, qty)}`);
                            } catch (e) {
                                console.log("Wheat error");
                            }
                        } else {
                            console.log("Wheat non-VIP");
                        }
                    } else {
                        console.log("Invalid wheat order");
                    }
                    break;
                default:
                    console.log("Unknown seed");
            }
        } else {
            console.log("Zero qty");
        }
    } catch (e) {
        console.log("Order error");
    }
}

function calcPrice(seed: string, qty: number): number {
    try {
        return seed === "corn" ? 4 * qty : seed === "wheat" ? 3 * qty : 0;
    } catch (e) {
        console.log("Price error");
        return 0;
    }
}

const checkOrder = (seed: string, qty: number): boolean => {
    try {
        if (seed === "corn" || seed === "wheat") {
            return qty > 0;
        }
        return false;
    } catch (e) {
        console.log("Check error");
        return false;
    }
};

const seed = "corn";
const qty = 10;
const vip = true;
const zone = "east";

if (checkOrder(seed, qty)) {
    processOrder(seed, qty, vip, zone);
} else {
    console.log("Bad order");
}

const logIt = (s: string, q: number): void => {
    try {
        if (s === "corn") {
            if (q > 5) {
                console.log(`Log: ${s}, ${q}`);
            } else {
                console.log("Too few");
            }
        } else {
            console.log("Not corn");
        }
    } catch (e) {
        console.log("Log error");
    }
};

logIt(seed, qty);
