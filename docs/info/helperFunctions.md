# Function References for helperFunctions.js

## Functions:
<br>

#### DMRequesterAboutRequestSubmission
- This function facilitates in sending the user who submitted a request a copy of their request via DM so that they know what was in the request, and that they submitted a request.
- Parameters and Intended Types
    - requesterUserID (string)
        - This is the Slack User ID of whoever is submitting a request.
    - requestID (string)
        - This is a Unique ID Number generated from calling the ```generateRequestID``` function.
    - description (string)
        - This is the description of the request. It's whatever the user inputted.
    -  productName (string)
        - This is whatever the user decides is the name for the product of the request. 
    - productCost (string)
        - This is the cost of the request. It should be number, but prior to calling this function, the bot does check to make sure the value being passed into this parameter is a number by checking that ```isNaN(Cost)``` returns false. If it were true, it would throw an error and stop.
    - transactionType_asText (string)
        - This identifies what type of product this is a request for. As of the moment this is being written, there are static options that can be chosen, but the user can't specify their own category. This is not entirely useful anymore as transactions are being being pushed directly into QBO anymore.
    - paymentMethod (string)
        -  This identifies the type of payment method. There are two values available. ```Cash``` and ```Credit Card```, however, these are not how it's expressed internally in the bot, but those are the values shown to the user, and they are the values passed into this parameter.
    - paymentToVendorOrCustomer (string)
        - This identifies whether the request is being paid to a Vendor (e.g. Google) or a customer. 
    - paymentToVendorOrCustomer_name
        - This identifies the Vendor or Customer's name.
    - imageLink (string)
        - This is for passing in image links, or realistically any sort of links. There's no real validation going on here so, it's more of a memo type field, but to the user, it's shown as a place to input a link.
            - This field is optional for the user to complete so if the user doesn't input anything, an empty string is passed through.
    - paymentDueByDate (string)
        - This is just the date that the user selected that this request needs to be paid by, if approved, when creating their request. It's pulls directly from Slack so it's properly formatted.
    - requestDetailMetadata (JSON)
        - This just passed through a bunch of the request details in a JSON format. This is later used and included as the metadata of the message sent to the user. 
    - ApproversMessageMetadata (JSON)
        - This passed through a JSON that contains the timestamp of the approvers' version of the request and the approvers' channel ID. 
#### sendErrorMessageOnThrow
- This function serves as an error handler and logger. When errors occur, (in the places where this is set up) it will generate an error UUID (if it's not provided), and alert both the user submitting the request, and the maintainer that an error occurred. It will also log the error stack inside a pre-setup Slack channel so that the error can be traced back to a line. 
- Parameters and Intended Types
    - userID (string)
        - This is the user ID of the Slack user who submitted or triggered the bot. It's sent in every Slack call.
    - errorMsg (string)
        - This is an error message that's either pre-written, which happens when I'm creating a new Error Object and then throwing it, or is a generic error message, which happens if it just happens randomly that's unexpected. 
        - This message is sent to the user, so it's typically a bit more detailed and contains instructions on how to fix the issue if it's an error that I'm throwing.
    - errorUUID (string)
        - This uses just a normal [UUIDv4][UUIDGithub] as the ID. This value can either be passed into the function, which happens in cases where the bot generates a UUID before it runs into any issues, or this parameter can be set to null, and it will automatically generate a new UUID for this error inside the function. If the UUID passed into the parameter is not valid (checked using ```uuidValidate``` from [UUIDv4][UUIDGithub_Validate]), then it will also just generate a new UUID. 
    - errorMsg_logging (string)
    - errorStack (string)
    - sendFile (boolean)
    - sendFile_text (string)
#### sendMessageUserIDAndMessage
#### generateRequestID
- Generates a Unique ID Number. 
    - it uses a combination of [UUIDv4][UUIDGithub] and the current time expressed as a unix timestamp to generate IDs that are unique.
- It returns the generated ID Number as a string.
#### expenseRequest_UpdateRequestMSG_denied
#### expenseRequest_UpdateRequestMSG


[//]: # (some comment)
[UUIDGithub]: <https://github.com/uuidjs/uuid>
[UUIDGithub_Validate]: <https://github.com/uuidjs/uuid#uuidvalidatestr>