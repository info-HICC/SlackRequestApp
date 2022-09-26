//this js file is used to create a variable
//called test which will determine the status of the start.js file
//when in test, the messages sent to other Slack channels will be redirected to the info account
//when not in test, the messages are sent to official channels
//this is for easy testing when modifications have to be made.

//this file is not currently used, but can be used in the future.
//file is already referenced inside of start.js

module.exports = {
    test: "false"
}