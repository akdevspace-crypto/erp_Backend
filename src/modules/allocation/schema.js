import { z } from 'zod';

export const allocationSchema = z.object({
    enquiryId: z.string().uuid("Enquiry ID is required"),
    staffId: z.string().uuid("Staff ID is required").nullable(),
    type: z.enum(['HOME_CARE', 'CLINICAL', 'IN_HOUSE', 'OTHERS']).default('HOME_CARE'),
    startDate: z.string(),
    endDate: z.string().optional()
});
