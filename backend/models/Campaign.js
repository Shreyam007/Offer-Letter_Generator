import mongoose from 'mongoose';

const campaignSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Template' },
    status: { type: String, enum: ['Draft', 'Sending', 'Completed'], default: 'Draft' },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    totalCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

campaignSchema.index({ companyId: 1 });
campaignSchema.index({ templateId: 1 });

const Campaign = mongoose.model('Campaign', campaignSchema);
export default Campaign;
