export const PLANS = {
  test10: {
    credits: 5,
    inr: 10,
    usd: 1,
  },

  starter: {
    credits: 100,
    inr: 499,
    usd: 6,
  },

  pro: {
    credits: 500,
    inr: 1499,
    usd: 18,
  },

  agency: {
    credits: 2000,
    inr: 4999,
    usd: 60,
  },
};

export function getCommissionRate(
  plan: string
): number {
  switch (plan) {
    case "test10":
      return 60;

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