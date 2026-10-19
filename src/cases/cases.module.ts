import {SupportPartDocumentService} from './support-part-document.service.js';
import {SupportPartOrderMailService} from './support-part-order-mail.service.js';
import {SupportSettlementService} from './support-settlement.service.js';
import {SupportSettlementController} from './support-settlement.controller.js';
import {SupportPartOrderService} from './support-part-order.service.js';
import {SupportPartOrderController} from './support-part-order.controller.js';
import {SupportQuoteService} from './support-quote.service.js';
import {SupportQuoteController,PublicSupportQuoteController} from './support-quote.controller.js';
import {SupportWorkService} from './support-work.service.js';
import {SupportNotificationsService} from './support-notifications.service.js';
import {CaseSupportController,PublicSupportController} from './support.controller.js';import {CaseSupportService} from './support.service.js';
import {CaseHandoverController} from './handover.controller.js';import {CaseHandoverService} from './handover.service.js';
import {CaseInstallationController} from './installation.controller.js';import {CaseInstallationService} from './installation.service.js';
import {CaseOrdersController} from './orders.controller.js';import {CaseOrdersService} from './orders.service.js';
import {CasePaymentsController} from './payments.controller.js';import {CasePaymentsService} from './payments.service.js';
import {CaseFilesService} from './files.service.js';
import {CaseFilesController} from './files.controller.js';
import {OfferEmailCodeService} from './offer-email-code.service.js';
import {CaseManagementController} from './management.controller.js';import {CaseManagementService} from './management.service.js';
import {CaseNotificationsService} from './notifications.service.js';import {CaseNotificationsController} from './notifications.controller.js';
import {ProposalDeliveriesController} from './deliveries.controller.js';import {ProposalDeliveriesService,ProposalMailTransport} from './deliveries.service.js';
import {ProposalInvitationsController,PublicOfferController} from './invitations.controller.js';import {ProposalInvitationsService} from './invitations.service.js';
import {ImportedCaseItemsController} from './imported-items.controller.js';import {ImportedCaseItemsService} from './imported-items.service.js';import {DealerCatalogsModule} from '../dealer-catalogs/catalogs.module.js';
import {CaseMediaController} from './media.controller.js';import {CaseMediaService} from './media.service.js';
import {FinanceController} from './finance.controller.js';import {FinanceService} from './finance.service.js';
import {Module} from '@nestjs/common';
import {AuthModule} from '../auth/auth.module.js';import {BundleModule} from '../bundle/bundle.module.js';import {CasesController} from './cases.controller.js';import {CasesService} from './cases.service.js';
@Module({imports:[AuthModule,BundleModule,DealerCatalogsModule],controllers:[SupportSettlementController,SupportPartOrderController,SupportQuoteController,PublicSupportQuoteController,CaseSupportController,PublicSupportController,CaseHandoverController,CaseInstallationController,CaseOrdersController,CasePaymentsController,CaseFilesController,CaseManagementController,CaseNotificationsController,ProposalDeliveriesController,ProposalInvitationsController,PublicOfferController,ImportedCaseItemsController,CasesController,FinanceController,CaseMediaController],providers:[SupportPartDocumentService,SupportPartOrderMailService,SupportSettlementService,SupportPartOrderService,SupportQuoteService,SupportWorkService,SupportNotificationsService,CaseSupportService,CaseHandoverService,CaseInstallationService,CaseOrdersService,CasePaymentsService,CaseFilesService,OfferEmailCodeService,CaseManagementService,CaseNotificationsService,ProposalDeliveriesService,ProposalMailTransport,ProposalInvitationsService,ImportedCaseItemsService,CasesService,FinanceService,CaseMediaService]})export class CasesModule{}












