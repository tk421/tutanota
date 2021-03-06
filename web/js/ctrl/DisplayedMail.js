"use strict";

tutao.provide('tutao.tutanota.ctrl.DisplayedMail');

/**
 * This class represents a mail that is currently displayed.
 * @param {tutao.entity.tutanota.Mail} mail The mail.
 * @constructor
 */
tutao.tutanota.ctrl.DisplayedMail = function (mail) {
    tutao.util.FunctionUtils.bindPrototypeMethodsToThis(this);
    this.mail = mail;


    this.bodyText = ko.observable(""); // contains the sanitized body
    this.bodyTextWithoutQuotation = ko.observable("");
    this.bodyTextQuotation = ko.observable("");
    this.bodyTextQuotationVisible = ko.observable(false);
    this.mailBodyLoaded = ko.observable(false);

    this.attachments = ko.observableArray(); // contains Files
    this.currentlyDownloadingAttachment = ko.observable(null); // null or a File

    this._loadBody();
    this._loadAttachments();

    var self = this;
    var isExternalAnswerPossible = function () {
        return tutao.locator.userController.isExternalUserLoggedIn() && self.mail.getState() == tutao.entity.tutanota.TutanotaConstants.MAIL_STATE_RECEIVED && tutao.tutanota.util.ClientDetector.getSupportedType() != tutao.tutanota.util.ClientDetector.SUPPORTED_TYPE_LEGACY_IE && tutao.tutanota.util.ClientDetector.getSupportedType() != tutao.tutanota.util.ClientDetector.SUPPORTED_TYPE_LEGACY_ANDROID;
    };
    var isExternalExportPossible = function () {
        // legacy_ie does not support internally used arraybuffers, legacy_safari does not support download, legacy_android does not support download.
        // we deactivate export for mobile browsers generally because it is useless
        return tutao.tutanota.util.ClientDetector.isSupported() && !tutao.tutanota.util.ClientDetector.isMobileDevice() && tutao.locator.userController.isExternalUserLoggedIn();
    };
    var isInternalUserLoggedIn = function() {
        return tutao.locator.userController.isInternalUserLoggedIn();
    };
    var showReplyAll = function () {
        return tutao.locator.userController.isInternalUserLoggedIn() && self.mail.getToRecipients().length + self.mail.getCcRecipients().length + self.mail.getBccRecipients().length > 1;
    };
    var trashed = function () {
        return self.mail.getTrashed();
    };
    var untrashed = function () {
        return !self.mail.getTrashed();
    };
    var trashText = self.mail.getTrashed() ? "undelete_action" : "delete_action";
    this.buttons = [
        // external
        new tutao.tutanota.ctrl.Button("replyConfidential_action", 10, function () {
            tutao.locator.mailViewModel.replyMail(self);
        }, isExternalAnswerPossible, false, "replyConfidentialAction"),

        new tutao.tutanota.ctrl.Button("export_action", 7, function () {
            tutao.locator.mailViewModel.exportMail(self);
        }, isExternalExportPossible, false, "exportAction"),

        // internal
        new tutao.tutanota.ctrl.Button("reply_action", 10, function () {
            tutao.locator.mailViewModel.replyMail(self);
        }, isInternalUserLoggedIn, false, "replyAction"),

        new tutao.tutanota.ctrl.Button("replyAll_action", 7, function () {
            tutao.locator.mailViewModel.replyAllMail(self);
        }, showReplyAll, false, "replayAllAction"),

        new tutao.tutanota.ctrl.Button("forward_action", 6, function () {
            tutao.locator.mailViewModel.forwardMail(self);
        }, isInternalUserLoggedIn, false, "forwardAction"),

        // all
        new tutao.tutanota.ctrl.Button("undelete_action", 9, function () {
            tutao.locator.mailViewModel.deleteMail(self);
        }, trashed, false, "undeleteMailAction"),

		new tutao.tutanota.ctrl.Button("finalDelete_action", 8, function () {
            tutao.locator.mailViewModel.finalDeleteMail(self);
        }, trashed, false, "finalDeleteMailAction"),
		
		new tutao.tutanota.ctrl.Button("delete_action", 8, function () {
            tutao.locator.mailViewModel.deleteMail(self);
        }, untrashed, false, "deleteMailAction"),
    ];
    this.buttonBarViewModel = new tutao.tutanota.ctrl.ButtonBarViewModel(this.buttons);
    this.buttonBarViewModel.init();
};

tutao.tutanota.ctrl.DisplayedMail.prototype.toggleQuotationVisible = function () {
    this.bodyTextQuotationVisible(!this.bodyTextQuotationVisible());
};

/**
 * Loads the mail body.
 */
tutao.tutanota.ctrl.DisplayedMail.prototype._loadBody = function () {
    var self = this;
//	setTimeout(function() {
    self.mail.loadBody().then(function (body) {
        self.bodyText(tutao.locator.htmlSanitizer.sanitize(body.getText()));
        var split = tutao.locator.mailView.splitMailTextQuotation(self.bodyText());
        self.bodyTextWithoutQuotation(split.text);
        self.mailBodyLoaded(true);
        self.bodyTextQuotation(split.quotation);
		// use setTimeout here to make sure the gui is updated
        setTimeout(function() {
            tutao.locator.mailView.addSubmitCheckToMailBody();
        }, 0);
    }).caught(function(e) {
        self.bodyText("error while loading");
        throw e;
    });
//	},1000);
};

/**
 * Loads the attached files.
 */
tutao.tutanota.ctrl.DisplayedMail.prototype._loadAttachments = function () {
    var self = this;
    //TODO (timely) implement loading of multiple LET instances
    for (var i = 0; i < this.mail.getAttachments().length; i++) {
        tutao.entity.tutanota.File.load(this.mail.getAttachments()[i]).then(function (file, exception) {
            if (!exception) {
                self.attachments.push(file);
            } else {
                console.log(exception);
            }
        });
    }
};

/**
 * Offers the user to download the given attachment.
 * @param {tutao.entity.tutanota.File} file The file to download.
 */
tutao.tutanota.ctrl.DisplayedMail.prototype.downloadAttachment = function (file) {
    // do not allow a new download as long as another is running
    if (this.currentlyDownloadingAttachment()) {
        return;
    }
    var self = this;
    this.currentlyDownloadingAttachment(file);
    tutao.locator.fileTransfer.downloadAndOpen(file).lastly(function (e) {
        self.currentlyDownloadingAttachment(null);
    });
};

/**
 * Provides the image that shall be shown in the attachment.
 * @param {tutao.entity.tutanota.File} file The file.
 * @return {String} The name of the image.
 */
tutao.tutanota.ctrl.DisplayedMail.prototype.getAttachmentImage = function (file) {
    var busy = (file == this.currentlyDownloadingAttachment());
    return tutao.tutanota.util.FileUtils.getFileTypeImage(file.getName(), busy);
};
