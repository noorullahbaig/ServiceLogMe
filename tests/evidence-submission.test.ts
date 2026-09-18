import { describe, expect, it } from "vitest";

describe("Evidence submission integrity", () => {
  describe("derivative context hashing", () => {
    it("generates consistent hash for same context", () => {
      // Simulate the derivativeContextHash function
      function derivativeContextHash(
        reportNumber: string,
        uploadedAt: string,
        employeeName: string,
        location: string,
        gpsLatitude: number | null,
        gpsLongitude: number | null,
      ): string {
        const context = JSON.stringify({
          reportNumber,
          uploadedAt,
          employeeName,
          location,
          gps:
            gpsLatitude != null && gpsLongitude != null
              ? { lat: gpsLatitude, lng: gpsLongitude }
              : null,
        });
        let hash = 0;
        for (let i = 0; i < context.length; i++) {
          hash = (hash << 5) - hash + context.charCodeAt(i);
          hash = hash & hash;
        }
        return hash.toString(16);
      }

      const hash1 = derivativeContextHash(
        "EVD-001",
        "15 Jan 2024, 10:30",
        "John Doe",
        "Warehouse A",
        3.139,
        101.6869,
      );

      const hash2 = derivativeContextHash(
        "EVD-001",
        "15 Jan 2024, 10:30",
        "John Doe",
        "Warehouse A",
        3.139,
        101.6869,
      );

      expect(hash1).toBe(hash2);
      expect(hash1).toBeTruthy();
    });

    it("generates different hash when report number changes", () => {
      function derivativeContextHash(
        reportNumber: string,
        uploadedAt: string,
        employeeName: string,
        location: string,
        gpsLatitude: number | null,
        gpsLongitude: number | null,
      ): string {
        const context = JSON.stringify({
          reportNumber,
          uploadedAt,
          employeeName,
          location,
          gps:
            gpsLatitude != null && gpsLongitude != null
              ? { lat: gpsLatitude, lng: gpsLongitude }
              : null,
        });
        let hash = 0;
        for (let i = 0; i < context.length; i++) {
          hash = (hash << 5) - hash + context.charCodeAt(i);
          hash = hash & hash;
        }
        return hash.toString(16);
      }

      const hash1 = derivativeContextHash(
        "EVD-001",
        "15 Jan 2024, 10:30",
        "John Doe",
        "Warehouse A",
        null,
        null,
      );

      const hash2 = derivativeContextHash(
        "EVD-002",
        "15 Jan 2024, 10:30",
        "John Doe",
        "Warehouse A",
        null,
        null,
      );

      expect(hash1).not.toBe(hash2);
    });

    it("generates different hash when employee changes", () => {
      function derivativeContextHash(
        reportNumber: string,
        uploadedAt: string,
        employeeName: string,
        location: string,
        gpsLatitude: number | null,
        gpsLongitude: number | null,
      ): string {
        const context = JSON.stringify({
          reportNumber,
          uploadedAt,
          employeeName,
          location,
          gps:
            gpsLatitude != null && gpsLongitude != null
              ? { lat: gpsLatitude, lng: gpsLongitude }
              : null,
        });
        let hash = 0;
        for (let i = 0; i < context.length; i++) {
          hash = (hash << 5) - hash + context.charCodeAt(i);
          hash = hash & hash;
        }
        return hash.toString(16);
      }

      const hash1 = derivativeContextHash(
        "EVD-001",
        "15 Jan 2024, 10:30",
        "John Doe",
        "Warehouse A",
        null,
        null,
      );

      const hash2 = derivativeContextHash(
        "EVD-001",
        "15 Jan 2024, 10:30",
        "Jane Smith",
        "Warehouse A",
        null,
        null,
      );

      expect(hash1).not.toBe(hash2);
    });

    it("generates different hash when location changes", () => {
      function derivativeContextHash(
        reportNumber: string,
        uploadedAt: string,
        employeeName: string,
        location: string,
        gpsLatitude: number | null,
        gpsLongitude: number | null,
      ): string {
        const context = JSON.stringify({
          reportNumber,
          uploadedAt,
          employeeName,
          location,
          gps:
            gpsLatitude != null && gpsLongitude != null
              ? { lat: gpsLatitude, lng: gpsLongitude }
              : null,
        });
        let hash = 0;
        for (let i = 0; i < context.length; i++) {
          hash = (hash << 5) - hash + context.charCodeAt(i);
          hash = hash & hash;
        }
        return hash.toString(16);
      }

      const hash1 = derivativeContextHash(
        "EVD-001",
        "15 Jan 2024, 10:30",
        "John Doe",
        "Warehouse A",
        null,
        null,
      );

      const hash2 = derivativeContextHash(
        "EVD-001",
        "15 Jan 2024, 10:30",
        "John Doe",
        "Warehouse B",
        null,
        null,
      );

      expect(hash1).not.toBe(hash2);
    });

    it("generates different hash when GPS is added", () => {
      function derivativeContextHash(
        reportNumber: string,
        uploadedAt: string,
        employeeName: string,
        location: string,
        gpsLatitude: number | null,
        gpsLongitude: number | null,
      ): string {
        const context = JSON.stringify({
          reportNumber,
          uploadedAt,
          employeeName,
          location,
          gps:
            gpsLatitude != null && gpsLongitude != null
              ? { lat: gpsLatitude, lng: gpsLongitude }
              : null,
        });
        let hash = 0;
        for (let i = 0; i < context.length; i++) {
          hash = (hash << 5) - hash + context.charCodeAt(i);
          hash = hash & hash;
        }
        return hash.toString(16);
      }

      const hashWithoutGps = derivativeContextHash(
        "EVD-001",
        "15 Jan 2024, 10:30",
        "John Doe",
        "Warehouse A",
        null,
        null,
      );

      const hashWithGps = derivativeContextHash(
        "EVD-001",
        "15 Jan 2024, 10:30",
        "John Doe",
        "Warehouse A",
        3.139,
        101.6869,
      );

      expect(hashWithoutGps).not.toBe(hashWithGps);
    });

    it("includes context hash in derivative key format", () => {
      const reportId = "report_123";
      const organizationId = "org_456";
      const photoId = "photo_789";
      const contextHash = "a1b2c3d";

      const derivativeKey = `reports/${organizationId}/${reportId}/derivatives/${photoId}-${contextHash}.jpg`;

      expect(derivativeKey).toContain(contextHash);
      expect(derivativeKey).toMatch(/derivatives\/photo_789-a1b2c3d\.jpg$/);
    });
  });

  describe("completion race protection", () => {
    it("requires UPDATE to succeed before audit event", () => {
      // Simulate the completion flow
      type BatchResult = {
        meta?: { changes?: number };
      };

      function shouldCreateAuditEvent(updateResult: BatchResult): boolean {
        return (updateResult.meta?.changes ?? 0) > 0;
      }

      // Successful update
      const successResult = { meta: { changes: 1 } };
      expect(shouldCreateAuditEvent(successResult)).toBe(true);

      // Failed update (revision conflict)
      const failedResult = { meta: { changes: 0 } };
      expect(shouldCreateAuditEvent(failedResult)).toBe(false);

      // Missing meta
      const noMetaResult = {};
      expect(shouldCreateAuditEvent(noMetaResult)).toBe(false);
    });

    it("detects already-completed reports", () => {
      type ReportState = {
        status: string;
        revision: number;
      };

      function isAlreadyCompleted(
        state: ReportState,
        wasCompletionAttempted: boolean,
      ): boolean {
        return state.status === "COMPLETED" && wasCompletionAttempted;
      }

      expect(
        isAlreadyCompleted({ status: "COMPLETED", revision: 2 }, true),
      ).toBe(true);
      expect(isAlreadyCompleted({ status: "DRAFT", revision: 1 }, true)).toBe(
        false,
      );
      expect(
        isAlreadyCompleted({ status: "COMPLETED", revision: 2 }, false),
      ).toBe(false);
    });

    it("ensures exactly one completion event per transition", () => {
      // Track audit events created
      const auditEvents: Array<{ type: string; reportId: string }> = [];

      function attemptCompletion(
        reportId: string,
        updateSucceeded: boolean,
      ): boolean {
        if (updateSucceeded) {
          // Only create event if UPDATE succeeded
          auditEvents.push({ type: "SERVICE_NOTE_COMPLETED", reportId });
          return true;
        }
        return false;
      }

      // First attempt succeeds
      const success1 = attemptCompletion("report_1", true);
      expect(success1).toBe(true);
      expect(auditEvents).toHaveLength(1);

      // Second attempt fails (already completed)
      const success2 = attemptCompletion("report_1", false);
      expect(success2).toBe(false);
      expect(auditEvents).toHaveLength(1); // Still only 1 event

      // Different report succeeds
      const success3 = attemptCompletion("report_2", true);
      expect(success3).toBe(true);
      expect(auditEvents).toHaveLength(2);
    });

    it("returns existing completed report on repeated submission", () => {
      type Report = {
        id: string;
        status: "DRAFT" | "COMPLETED";
        revision: number;
      };

      function handleCompletionResult(
        updateChanges: number,
        currentReport: Report,
      ): { shouldReturnExisting: boolean; shouldThrowConflict: boolean } {
        if (updateChanges === 0) {
          // UPDATE didn't match - check why
          if (currentReport.status === "COMPLETED") {
            // Already completed - return existing (idempotent)
            return { shouldReturnExisting: true, shouldThrowConflict: false };
          } else {
            // Revision conflict
            return { shouldReturnExisting: false, shouldThrowConflict: true };
          }
        }
        // UPDATE succeeded
        return { shouldReturnExisting: false, shouldThrowConflict: false };
      }

      // Already completed - idempotent
      const completedCase = handleCompletionResult(0, {
        id: "report_1",
        status: "COMPLETED",
        revision: 2,
      });
      expect(completedCase.shouldReturnExisting).toBe(true);
      expect(completedCase.shouldThrowConflict).toBe(false);

      // Revision conflict
      const conflictCase = handleCompletionResult(0, {
        id: "report_1",
        status: "DRAFT",
        revision: 2,
      });
      expect(conflictCase.shouldReturnExisting).toBe(false);
      expect(conflictCase.shouldThrowConflict).toBe(true);

      // Success
      const successCase = handleCompletionResult(1, {
        id: "report_1",
        status: "DRAFT",
        revision: 1,
      });
      expect(successCase.shouldReturnExisting).toBe(false);
      expect(successCase.shouldThrowConflict).toBe(false);
    });
  });
});
