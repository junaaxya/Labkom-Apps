CREATE UNIQUE INDEX "academic_slot_requests_one_active_per_release_key"
ON "academic_slot_requests"("releaseId")
WHERE "status" IN ('PENDING', 'APPROVED');
