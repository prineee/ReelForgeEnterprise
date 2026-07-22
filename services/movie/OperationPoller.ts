import { checkVideoOperation } from "@/services/ai/gemini";

export class OperationPoller {
  static async wait(operationId: string) {

    while (true) {

      const result =
        await checkVideoOperation(
          operationId
        );

      if (result.completed) {
        return result;
      }

      await new Promise(resolve =>
        setTimeout(resolve, 3000)
      );
    }
  }
}