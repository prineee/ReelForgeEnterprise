export const PLANS = {
  starter: {
    credits: 100,
    inr: 499,
    usd: 6,
  },

  pro: {
    credits: 500,
    inr: 999,
    usd: 18,
  },

  agency: {
    credits: 2000,
    inr: 2999,
    usd: 60,
  },
};

export function getCommissionRate(
  plan: string
): number {
  switch (plan) {
    case "starter":
      return 60;

    case "pro":
      return 40;

    case "agency":
      return 50;

    default:
      return 30;
  }
}