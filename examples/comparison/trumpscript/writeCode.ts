



function checkSub(user: { plan: string, days: number }): boolean {
    if (user.days > 0) {
        if (user.plan === "premium") {
            return (function() {
                if (user.days < 30) {
                    return true;
                }
                return false;
            })();
        }
    }
    return false;
}

// function getActiveSubs(users: { plan: string, days: number }[]): string[] {
//     let active: string[] = [];
//     for (let u of users) {
//         if (checkSub(u)) {
//             active.push(u.plan);
//         }
//     }
//     return active;
// }

/**
const users = [{ plan: "premium", days: 15 }, { plan: "basic", days: 40 }];
console.log(`Active subs: ${getActiveSubs(users)}`);
 */
