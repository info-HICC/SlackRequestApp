module.exports.updateMessageContent = function (task_id, task_title, task_description, task_due_date, JSON_channel_ts) {
    var template = `{
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "Task Assignment",
                    "emoji": true
                }
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "plain_text",
                        "text": "Here are the contents of a task that was assigned to you.",
                        "emoji": true
                    }
                ]
            },
            {
                "type": "divider"
            },
            {
                "type": "context",
                "block_id": "task_id_BlockID",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": ">RequestID: \`${task_id}\`"
                    }
                ]
            },
            {
                "type": "context",
                "block_id": "task_title_BlockID",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": ">The name of the task: \`${task_title}\`."
                    }
                ]
            },
            {
                "type": "context",
                "block_id": "task_description_BlockID",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": ">The description of the task: \`${task_description}\`"
                    }
                ]
            },
            {
                "type": "context",
                "block_id": "task_due_date_BlockID",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": ">The assigned due date is \`${task_due_date}\`."
                    }
                ]
            },
            {
                "type": "context",
                "block_id": "JSON_channel_ts_BlockID",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": ">You can ignore this, it's just for reference: \`${JSON_channel_ts}\`."
                    }
                ]
            },
            {
                "type": "divider"
            },
            {
                "type": "actions",
                "block_id": "TaskDone_TaskNotDone_BlockID",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Task Done",
                            "emoji": true
                        },
                        "value": "TaskDone",
                        "action_id": "TaskDone_ActionID"
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Task Not Done By Due Date",
                            "emoji": true
                        },
                        "value": "TaskNotDone",
                        "action_id": "TaskNotDone_ActionID"
                    }
                ]
            }
        ]
    }`;
    return template;
};

module.exports.createRequestMessageForApprovers = async function (inputData) {
    var inputData_parsed = JSON.parse(inputData);
    var requesterID = inputData_parsed.requesterID;
    var requestID = inputData_parsed.requestID;
    var JSON_ts = inputData_parsed.JSON_ts;
    var task_description = inputData_parsed.task_description;
    var productName = inputData_parsed.productName;
    var productCost = inputData_parsed.productCost;
    var transactionType_asText = inputData_parsed.transactionType_asText;
    var paymentMethod = inputData_parsed.paymentMethod;
    var paymentToVendorOrCustomer = inputData_parsed.paymentToVendorOrCustomer;
    var paymentToVendorOrCustomer_name = inputData_parsed.paymentToVendorOrCustomer_name;
    var makePaymentByDate = inputData_parsed.makePaymentByDate;
    var imageLinksThatWereSubmitted = inputData_parsed.imageLinksThatWereSubmitted;

    var template = `{
        "blocks": [
            {
                "type": "section",
                "block_id": "approvers_requesterNotification_BlockID",
                "text": {
                    "type": "mrkdwn",
                    "text": "*New Expense request from <@${requesterID}>*"
                }
            },
            {
                "type": "section",
                "block_id": "approvers_requestID_BlockID",
                "text": {
                    "type": "mrkdwn",
                    "text": "*Request ID:*${requestID}"
                }
            },
            {
                "type": "section",
                "block_id": "approvers_JSONts_BlockID",
                "text": {
                    "type": "mrkdwn",
                    "text": "*Timestamp of JSON version of message:*${JSON_ts}"
                }
            },
            {
                "type": "section",
                "block_id": "approvers_requestDescription_BlockID",
                "text": {
                    "type": "mrkdwn",
                    "text": "*Description (also part of Memo on Quickbooks Online):*\n${task_description}"
                }
            },
            {
                "type": "section",
                "block_id": "approvers_requestInformation_BlockID",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": ">*Product Name:*\n>${productName}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": ">*Product Cost:*\n>$${productCost}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": ">*Expense Type/Category:*\n>${transactionType_asText}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": ">*Payment Method:*\n>${paymentMethod}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": ">*Vendor or Customer:*\n>${paymentToVendorOrCustomer}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": ">*Vendor or Customer Name:*\n>${paymentToVendorOrCustomer_name}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": ">*Payment should be made by:*\n>${makePaymentByDate}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": ">*Any images that may have been attached:*\n>${imageLinksThatWereSubmitted}"
                    },
                ]
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "emoji": true,
                            "text": "Approve"
                        },
                        "confirm": {
                            "title": {
                                "type": "plain_text",
                                "text": "Are you sure?"
                            },
                            "text": {
                                "type": "mrkdwn",
                                "text": "Wouldn't you prefer a good game of _chess_?"
                            },
                            "confirm": {
                                "type": "plain_text",
                                "text": "Do it"
                            },
                            "deny": {
                                "type": "plain_text",
                                "text": "Stop, I've changed my mind!"
                            }
                        },
                        "style": "primary",
                        "value": "click_me_123"
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "emoji": true,
                            "text": "Deny"
                        },
                        "style": "danger",
                        "value": "click_me_123"
                    }
                ]
            }
        ]
    }`;
    return template;
}

// //export the modal view
// module.exports = {
//     updateMessage: taskeeUpdateMessage
// };