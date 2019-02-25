//fs is needed for the import/export of files
const Discord = require('discord.js');
const fs = require('fs')
const lodash = require('lodash');
//for scheduling log exports
const schedule = require('node-schedule');
//these 3 are dependensies for node-schedule
const sorted = require('sorted-array-functions');
const parser = require('cron-parser');
const lt = require('long-timeout')
//
const emojiFilter = (reaction, user) => reaction.emoji.name === "❤"||"💛"||'💚'||"💙"||"💜"||"💖";
var emoji = ["❤","💛",'💚',"💙","💜","💖"]
const fsmi = require('fs-minipass')
const MiniPass = require('minipass')
const yallist = require('yallist')
const mkdirp = require('mkdirp');
const fsm = require('fs-minipass')
const {
    Pool
} = require("better-sqlite-pool");
const Buffersafe = require('safe-buffer').Buffer
const client = new Discord.Client();
const Enmap = require("enmap");
var usersActive = [];

const config = require("./config.json");
client.config = config;
var Integer = require('integer');
var finishedVoiceLogs = [];
//the location of the voiceLogs
var voiceLogDir = './botfiles/voicelogstest/'
//broken voiceLogfiles
var brokenFiles: Array < string > = [];

//not broken voicelog files
var voiceLogNames: Array < string > = [];
var guilds: Array < guildObject > = [];
//enmap is a SQLite library
var guildMap = new Enmap({
    name: "guilds",
    autoFetch: true,
    fetchAll: true,
});

// this object class containts the info of people who are currently active in a voice channel
class userInVoiceChannel {
    userName: string;
    id: string;
    voiceChannel: string;
    voiceChannelid: string;
    timeJoin: number;
    guildid: string;


}

class party {
  id:string;
  members = []
}
class channelToAnalyse {
    channelid: string;
    channelName: string;
    channelLogs: Array < completeLog > = []
}
class channelUseTime {
    channelName: string;
    channelTime: number;
}

class completeLog {
    userName: string;
    userid: string;
    voiceChannel: string;
    voiceChannelid: string;
    timeJoin: number;
    timeLeave: number;
    guildid: string;

}
//represents each guild
class guildObject {
    guildid: string;
    guildLogs = [];
    emojiRoles = []

}
class emojiRole{
  emoji:any;
  role:string;
  name:string;
}

//automatically exports/imports voiceLogs using node-scheduler
var exportImport = schedule.scheduleJob('0 58 * * * *', function() {
    moveLogsToDB(guilds)
});

function shuffle(array) {
    var m = array.length,
        t, i;

    // While there remain elements to shuffle…
    while (m) {

        // Pick a remaining element…
        i = Math.floor(Math.random() * m--);

        // And swap it with the current element.
        t = array[m];
        array[m] = array[i];
        array[i] = t;
    }

    return array;
}
//last step of the emoji menu process
function assignEmojiRoles(message) {
  guildMap.defer.then(() => {
    let thisGuild = guildMap.get(message.guild.id)

    let msgReactions = message.reactions.array()
    msgReactions = msgReactions.filter(function(reaction) {
        return emoji.indexOf(reaction.name)
    })
    for (let msgEmoji of msgReactions) {

        let thisRole = thisGuild.emojiRoles.find(function(role){
          return role.emoji === msgEmoji.emoji.name
        })


                  let theseUsers = msgEmoji.fetchUsers()
            .then((theseUsers) => {
                theseUsers = theseUsers.array()
                theseUsers = theseUsers.filter(function(user) {
                    return user.id !== '233458197338390528'
                })
                for (let thisUser of theseUsers) {
                let emojiMember =  message.guild.members.get(thisUser.id)
                emojiMember.addRole(thisRole.role)
                    msgEmoji.remove(thisUser)
                }
            })

    }
})}
//second step of Emojimenu
function emojiMenu(botMessage) {
guildMap.defer.then(()=> {
  let messageEdit = []
  let thisGuild = guildMap.get(botMessage.guild.id)
  for(let emoji of thisGuild.emojiRoles){
    botMessage.react(emoji.emoji)
    messageEdit.push(emoji.name+" : "+emoji.emoji+"\r")
  }
let  messageToSend = messageEdit.toString()
  messageToSend = messageToSend.replace(/,/g, " ");
  botMessage.edit({
      embed: {
          color: 3447003,

          title: "Use these Reactions to assing roles!",

          description: messageToSend,



          timestamp: new Date(),
          footer: {
              icon_url: client.user.avatarURL,
              text: "© BetterBots"
          }
      }
  })
})

  let collector = botMessage.createReactionCollector(emojiFilter, {});


  collector.on('collect', (reaction, collector) => {
     assignEmojiRoles(botMessage)
  });
  collector.on('end', collected => {
    console.log(`collected ${collected.size} reactions`);
  });
}
//gets logs within a certain timeframe from the current moment, eg past week of logs, past moths etc
function getWithinTimeFrame(logs, timeframe) {
    let time = new Date().getTime();
    let logsInTimeFrame = logs.filter(function(log){
      return time - log.timeJoin < timeframe
    })
    return logsInTimeFrame;
}
//converts milliseconds to hours and rounds to 2 decimal places
function convertToHours(miliseconds) {
    miliseconds = miliseconds / 3600000
    let hours = Math.round(miliseconds * 100) / 100
    return hours
}
//creates the guild objects on startup
function createGuildObjects() {
    var guildArray = client.guilds.array();
    for (let x of guildArray) {
        var newGuild = new guildObject;
        newGuild.guildid = x.id;
        guilds.push(newGuild)

    }

}

//could use just a find function but hey it works
//needs update
function sortLogsIntoGuildObject(log) {
    for (let x of guilds) {
        if (x.guildid === log.guildid) {
            x.guildLogs.push(log)
        }
    }
}
//finds the people who are online as of the bot turning on
function checkOfflineVoice(guild) {
    let members = guild.members.array();
    for (let x of members) {
        if (x.voiceChannel) {
            createPartialLog(x);
        }
    }

}
//first half of a finished log, created when a member is detected going online
function createPartialLog(newMember) {
    let log = new userInVoiceChannel
    let time = new Date();
    let timeMili = time.getTime();
    log.userName = newMember.displayName
    log.id = newMember.id
    log.guildid = newMember.guild.id
    log.voiceChannel = newMember.voiceChannel.name
    log.voiceChannelid = newMember.voiceChannelID
    log.timeJoin = timeMili;
    usersActive.push(log)
}

//finds the join log of a member that goes offline, returns the log and removes it from the online user list
function findMatchingLog(id) {
    for (let x in usersActive) {
        let splicespot = 0;
        if (usersActive[x].id === id) {

            let logToReturn = usersActive[x];
            let discard = usersActive.splice(splicespot, 1)
            return logToReturn;
        }
        splicespot++
    }
}
//takes the partial log and converts to a complete log
function createFinalLog(partialLog) {
  if(partialLog){
    let time = new Date()
    let timeMili = time.getTime();
    let log = new completeLog;
    log.userid = partialLog.id;
    log.voiceChannel = partialLog.voiceChannel;
    log.voiceChannelid = partialLog.voiceChannelid;
    log.timeJoin = partialLog.timeJoin;
    log.guildid = partialLog.guildid;
    log.userName = partialLog.userName;
    log.timeLeave = timeMili;
    sortLogsIntoGuildObject(log);
}}
//checks whether its a user coming online or going offline, returns 0-3 depending on the change
//0 is a mute/unmute, should be ignored
//1 is a channel change
//2 is going offline
//3 is coming online
function checkChange(oldMember, newMember) {
    if (oldMember.voiceChannel) {
        if (newMember.voiceChannel) {
            //if the channelID's are the same it means it was just a mute/unmute
            if (oldMember.voiceChannelID === newMember.voiceChannelID) {
                return 0;
            }
            //this checks if they changed channels but are still online
            else if (oldMember.voiceChannelID != newMember.voiceChannelID) {
                return 1;
            }
        } else {
            return 2
        }
    } else {
        return 3
    }
}
//used by getAllUsers

//fetches list of all members to check for anyone online as of the bot turning on
function getAllUsers() {
    let allGuilds = client.guilds.array();

    for (let x of allGuilds) {
        let currentGuild = x;
        currentGuild.fetchMembers('', 10000)
            .then(Guild => checkOfflineVoice(Guild))
            .catch(console.error)


    }
}
//moves the logs from the temporary memory to SQLite map
function moveLogsToDB(guildArray) {
    guildMap.defer.then(() => {
        for (var x of guildArray) {
            var fetchid = x.guildid;
            var offlineLogs = x.guildLogs;

            //this line is to trick the typescript compiler because it bugs out ignore it
            var guildLogs

            var currentDBGuild = guildMap.get(fetchid)



            currentDBGuild.guildLogs = currentDBGuild.guildLogs.concat(offlineLogs)
            guildMap.set(fetchid, currentDBGuild)
            x.guildLogs = []
        }
    })
}
//this function lets the bot send fancy embeded messages without having to write it out each time
function sendEmbed(guildName, channel, array, title) {
    let stringMessage = array.join()

    stringMessage = stringMessage.replace(/,/g, " ");
    stringMessage = stringMessage.replace(",", "");
    stringMessage = stringMessage.replace("@everyone", "");

    client.channels.get(channel).send({
        embed: {
            color: 3447003,
            author: {
                name: guildName,
                icon_url: client.user.avatarURL
            },
            title: title,

            description: stringMessage,



            timestamp: new Date(),
            footer: {
                icon_url: client.user.avatarURL,
                text: "© BetterBots"
            }
        }
    })


}
client.login(config.testtoken);
//startup procedures
client.on('ready', () => {
    console.log('we in')
    getAllUsers();
    createGuildObjects();
    guildMap.defer.then(() => {
        for (var x of guilds) {
            var stringid = x.guildid.toString()


            if (!guildMap.has(stringid)) {
                console.log('new guild in db')
                guildMap.set(stringid, x);
            } // works
            var guildList = guildMap.get(stringid); // also works
            console.log("guild:"+guildList.guildLogs.length)


        }
    });

})
//EVENTS
client.on('guildCreate', (guildCreate) => {
    var newGuild = new guildObject;
    newGuild.guildid = guildCreate.id;
    guilds.push(newGuild)
})
//checks what kind of change happens on a VSU and reacts appropriately. Codes are at checkChange
client.on('voiceStateUpdate', (oldMember, newMember) => {
    if (checkChange(oldMember, newMember) === 1) {
        createFinalLog(findMatchingLog(oldMember.id))
        createPartialLog(newMember)

    } else if (checkChange(oldMember, newMember) === 2) {
        createFinalLog(findMatchingLog(oldMember.id))
    } else if (checkChange(oldMember, newMember) === 3) {
        createPartialLog(newMember)
    }
})
//COMMANDS
client.on('message', message => {
    if (message.author.bot) {
        return
    } else if (message.content.startsWith(config.testprefix + "dbtest")) {
        moveLogsToDB(guilds)
    } else if (message.content.startsWith(config.testprefix + "logs")) {
        for (var y of guilds) {
            console.log(y.guildid + " " + y.guildLogs.length)
        }
        guildMap.defer.then(() => {
            for (var x of guilds) {
                var stringid = x.guildid.toString()
                console.log(guildMap.size + " keys loaded");

                var guildList = guildMap.get(x.guildid); // also works

                console.log("guild " + guildList.guildid + " " + guildList.guildLogs.length)
                var consoleItem = guildList.guildLogs[0]

                console.log(consoleItem)
            }
        })
    } else if (message.content.startsWith(config.testprefix + "delete database")) {
        if (message.author.id === "169267421574725633") {
            guildMap.deleteAll()
            console.log("deleted guildMap")
        } else(message.channel.send("only Bubblz can do that"))
    } else if (message.content.startsWith(config.testprefix + "past week")) {
        //this command is a bit outdated, needs to be cleaned up
        let guild = message.guild.id;
        let voiceChannelObjs = [];
        let finalObjs = [];
        let messageToSend = []
        let combinedTimes = 0;
        guildMap.defer.then(() => {
            let guildLogs = guildMap.get(guild)
            guildLogs = guildLogs.guildLogs; // I need more names for things...
            console.log("guildLogs:" + guildLogs.length)
            guildLogs = getWithinTimeFrame(guildLogs, 604800000)

            let guildChannels = message.guild.channels.array()

            //collects currently existing channels
            for (var i of guildChannels) {
                if (i.type === "voice") {
                    let logObj = new channelToAnalyse
                    logObj.channelid = i.id.toString();
                    logObj.channelName = i.name
                    voiceChannelObjs.push(logObj)
                }

            }
            for (var obj of voiceChannelObjs) {
                let thisChannelsLogs = [];
                for (var log of guildLogs) {

                    if (log.voiceChannelid === obj.channelid) {

                        thisChannelsLogs.push(log)
                    }



                }



                obj.channelLogs = thisChannelsLogs;
            }


            for (var i of voiceChannelObjs) {

                let channelTime = 0
                for (var x of i.channelLogs) {

                    let useTime = x.timeLeave - x.timeJoin
                    channelTime += useTime;

                }
                let newObj = new channelUseTime
                newObj.channelName = i.channelName

                newObj.channelTime = convertToHours(channelTime)
                finalObjs.push(newObj)
            }
            finalObjs.sort(function(a, b) {
                return b.channelTime - a.channelTime
            })

            for (var log of finalObjs) {
                messageToSend.push("**" + log.channelName + "** : " + log.channelTime + " Hours \r")
            }
            sendEmbed(message.channel.guild.name, message.channel.id, messageToSend, "Voice Use in the Past Week")
        })

    } else if (message.content.startsWith(config.testprefix + "selfcheck")) {
        let authorid = message.member.id.toString();
        let channels = message.guild.channels.array();
        channels = channels.filter(function(channel) {
            return channel.type === "voice"
        })

        guildMap.defer.then(() => {
            let channelsSorted = []
            let messageArray = []
            let userLogs = guildMap.get(message.guild.id)
            userLogs = userLogs.guildLogs


            userLogs = userLogs.filter(function(id) {
                return id.userid === authorid;
            })

            for (var i of channels) {
                let channelTime = 0;
                var globalChannelid = i.id.toString()

                let thisChannelsLogs = userLogs.filter(function(log) {
                    return log.voiceChannelid === globalChannelid

                })

                for (var k of thisChannelsLogs) {

                    let timeSpent = k.timeLeave - k.timeJoin;

                    channelTime += timeSpent
                }
                let newObj = new channelUseTime

                channelTime = convertToHours(channelTime)

                newObj.channelName = i.name;
                newObj.channelTime = channelTime;

                channelsSorted.push(newObj)
            }
            channelsSorted = channelsSorted.sort(function(a, b) {
                return b.channelTime - a.channelTime
            })
            for (var channel of channelsSorted) {
                messageArray.push("**" + channel.channelName + "** : " + channel.channelTime + " \r")

            }
            sendEmbed(message.channel.guild.name, message.channel.id, messageArray, "Heres your activity!")
        })
    }
    //the role commands work off of the built in role hierarchy in Discord
    //it finds a role with the name "roletab", then compares the position of that role to the one they are trying to join, if the role they are joining is lower then they are allowed to add it
    //like this
    //Admin
    //roletab
    //Overwatch
    //PUBG
    else if (message.content.startsWith(config.rolePrefix + "add")) {
        let messageToSend = []
        let rolesNotAdded = [];
        let myRole = message.guild.roles.find(function(roles) {
            return roles.name === "roletab"
        });
        let thisMember = message.member;
        if (myRole) {
            let msgString = message.content;
            //removes the prefix text
            msgString = msgString.substring(9);
            msgString = msgString.toUpperCase()
            //seperates the roles
            let rolesToCheck = msgString.split(', ')


            for (var x of rolesToCheck) {
                let currentRole = message.guild.roles.find(function(roles) {
                    return roles.name.toUpperCase() === x
                });
                if (currentRole) {
                    if (myRole.comparePositionTo(currentRole) > 0) {
                        thisMember.addRole(currentRole)
                        messageToSend.push(currentRole.name)
                    } else(rolesNotAdded.push(x))
                } else(rolesNotAdded.push(x))
            }
            let rolesNotAddedToSend = rolesNotAdded.toString();
            rolesNotAddedToSend = rolesNotAddedToSend.replace(/,/g, " ")
            rolesNotAddedToSend = rolesNotAddedToSend.replace('@everyone', "")
            let messageToSendForReal = messageToSend.toString();
            messageToSendForReal = messageToSendForReal.replace(/,/g, " ");
            messageToSendForReal = messageToSendForReal.replace('@everyone', "")
            message.channel.send({
                embed: {
                    color: 2552550,
                    author: {
                        name: message.member.name,
                        icon_url: message.guild.splashURL,
                    },
                    fields: [{
                            name: "Roles Added",
                            value: '- ' + messageToSend
                        },
                        {
                            name: "Roles not Added",
                            value: '- ' + rolesNotAdded
                        },

                    ],
                    timestamp: new Date(),
                    footer: {
                        icon_url: client.user.avatarURL,
                        text: "© BetterBots"
                    }
                }
            })
        } else {
            message.channel.send('You dont have the finder role, make sure you have a role named "roletab" above the roles you want to have self added!')
        }
    } else if (message.content.startsWith(config.rolePrefix + "leave")) {
        let messageToSend = []
        let rolesNotAdded = [];
        let myRole = message.guild.roles.find(function(roles) {
            return roles.name === "roletab"
        });

        let thisMember = message.member;
        if (myRole) {
            if (message.content.startsWith(config.rolePrefix + 'leave all!!')) {
                let thisMember = message.member;
                let thisMemberRoles = thisMember.roles.array();
                let rolesLeft = [];
                for (var x of thisMemberRoles) {

                    if (myRole.comparePositionTo(x) > 0) {
                        thisMember.removeRole(x)
                        rolesLeft.push(x.name + '\r')
                    }

                }
                sendEmbed(message.channel.guild.name, message.channel.id, rolesLeft, "Removed These Roles")
            } else {
                let msgString = message.content;
                //removes the prefix text
                msgString = msgString.substring(11);
                msgString = msgString.toUpperCase()
                //seperates the roles
                let rolesToCheck = msgString.split(', ')


                for (var x of rolesToCheck) {
                    let currentRole = message.guild.roles.find(function(roles) {
                        return roles.name.toUpperCase() === x
                    });
                    if (currentRole) {
                        if (myRole.comparePositionTo(currentRole) > 0) {
                            thisMember.removeRole(currentRole)
                            messageToSend.push(currentRole.name)
                        } else(rolesNotAdded.push(x))
                    } else(rolesNotAdded.push(x))
                }
                let rolesNotAddedToSend = rolesNotAdded.toString();
                rolesNotAddedToSend = rolesNotAddedToSend.replace(/,/g, " ")
                rolesNotAddedToSend = rolesNotAddedToSend.replace('@everyone', "")
                let messageToSendForReal = messageToSend.toString();
                messageToSendForReal = messageToSendForReal.replace(/,/g, " ");
                messageToSendForReal = messageToSendForReal.replace('@everyone', "")
                message.channel.send({
                    embed: {
                        color: 2552550,
                        author: {
                            name: message.member.name,
                            icon_url: message.guild.splashURL,
                        },
                        fields: [{
                                name: "Roles Removed",
                                value: '- ' + messageToSend
                            },
                            {
                                name: "Roles not Removed",
                                value: '- ' + rolesNotAdded
                            },

                        ],
                        timestamp: new Date(),
                        footer: {
                            icon_url: client.user.avatarURL,
                            text: "© BetterBots"
                        }
                    }
                })
            }
        } else {
            message.channel.send('You dont have the finder role, make sure you have a role named "roletab" above the roles you want to have self added!')
        }
    } else if (message.content.startsWith(config.rolePrefix + "roles")) {
        let myRole = message.guild.roles.find(function(roles) {
            return roles.name === "roletab"
        });
        if (myRole) {
            let guildRoles = message.guild.roles.array();
            console.log(myRole)

            var roleMessageToSend = [];
            for (var x of guildRoles) {


                if (myRole.comparePositionTo(x) > 0) {
                    console.log("found one")
                    roleMessageToSend.push(x.name + "\r")


                }

            }
            sendEmbed(message.channel.guild.name, message.channel.id, roleMessageToSend, "Joinable Roles")

        } else(message.channel.send('role setting is not enabled on this server, to enable type "b3 adminhelp"'))
    } else if (message.content.startsWith(config.testprefix + "channel survey")) {}
//just a fun little boop command
    else if (message.content.startsWith(config.testprefix + "boop")) {

        message.channel.send('please respect my personal space, ' + message.member.displayName)
    }
    //emojimenu is in dev still, but it makes an interactable role menu using reactions
    else if (message.content.startsWith(config.testprefix + "emojimenu")) {

        message.channel.send("Use these reactions to give yourself roles!")
            .then(message => emojiMenu(message))
            .catch(error => console.log(error))

    }
    //splits people into groups of adjustable sizes, doesnt actually move anyone at the moment, only sends a message with the different teamSize
    //want to make it split people automatically later
    else if (message.content.startsWith(config.testprefix + "party")) {
    //makes sure that the member is in a voicechannel, so that it has people to split up
        if (message.member.voiceChannel) {


            let teamSize
            let subStringInd = 9;
            let teams = []
            let messageString = []
            let totalPeople = message.member.voiceChannel.members.array()
            //partyadmin is for when the person sending the command doesnt want to be sorted into a team
            if (message.content.startsWith(config.prefix + "partyadmin")) {
                totalPeople = totalPeople.filter(function(user) {
                        return user.id !== message.member.id
                    }

                )
                subStringInd = 14
            }

            let substring = message.content.substring(subStringInd)

            //check if they want to customize the teamSize
            if (isNaN(substring) === false && substring > 0) {
                teamSize = substring

            } else(teamSize = totalPeople.length / 2)


            let totalPeopleString = [];
            for (let member of totalPeople) {
                totalPeopleString.push(member.displayName)
            }
            totalPeopleString = shuffle(totalPeopleString);
            let teamCount = Math.ceil(totalPeopleString.length / teamSize);
            let loopCount = 0
            while (loopCount < teamCount) {
                let thisTeamFormatted = []
                let thisTeam = totalPeopleString.splice(0, teamSize)


                let newTeam = new party
                newTeam.members = thisTeam
                newTeam.id = "**Party " + (loopCount + 1) + "**\r"
                loopCount++
                teams.push(newTeam)

            }

            for (let team of teams) {
                messageString.push(team.id + team.members + "\r")
            }
            if (!substring) {
                sendEmbed(message.channel.guild.name, message.channel.id, messageString, "Parties")
            } else(sendEmbed(message.channel.guild.name, message.channel.id, messageString, teamSize + " Man Parties"))
        } else(message.channel.send("you have to be in a voice channel"))
    } else if (message.content.startsWith(config.testprefix + "rolecheck")) {
//counts all the roles on the server below Roletab and orders them
        class roleCount {
            role: string;
            count: number;
        }
        let roleObjects = [];
        let messageToSend = [];
        let roles = message.guild.roles.array()
        let roleTab = message.guild.roles.find(function(role) {
            return role.name === "roletab"
        });
        roles = roles.filter(function(role) {
            return roleTab.comparePositionTo(role) > 0
        })
        roles = roles.filter(function(role) {
            return role.name !== "@everyone"
        })
        for (let role of roles) {
            let thisRole = new roleCount
            thisRole.role = role.name
            thisRole.count = message.guild.roles.get(role.id).members.array().length
            roleObjects.push(thisRole)

        }
        roleObjects = roleObjects.sort(function(a, b) {
            return b.count - a.count
        })
        for (let role of roleObjects) {
            messageToSend.push(role.role + " : " + role.count + "\r")
        }
        sendEmbed(message.channel.guild.name, message.channel.id, messageToSend, "**Most Popular Self-Assigned Roles**")
    } else if (message.content.startsWith(config.testprefix + "check user")) {
      //gets the lifetime voice use of a member based on ID
        let userid = message.content.substring(14)
        let thisUser = message.guild.members.get(userid)
        //gets the users name from the guild and also the current voice channels to check, we have the logs of unused voicechannels but are not including them at this time for better readablity
        if (thisUser) {
            userid = thisUser.id
            let userName = thisUser.displayName
            let channels = message.guild.channels.array();
            channels = channels.filter(function(channel) {
                return channel.type === "voice"
            })

            guildMap.defer.then(() => {
                let channelsSorted = []
                let messageArray = []
                let userLogs = guildMap.get(message.guild.id)
                userLogs = userLogs.guildLogs

                //gets all the logs for this member
                userLogs = userLogs.filter(function(id) {
                    return id.userid === userid;
                })

                for (var i of channels) {
                  //sorts users logs into objects for each channel
                    let channelTime = 0;
                    var globalChannelid = i.id.toString()

                    let thisChannelsLogs = userLogs.filter(function(log) {
                        return log.voiceChannelid === globalChannelid

                    })

                    for (var k of thisChannelsLogs) {

                        let timeSpent = k.timeLeave - k.timeJoin;

                        channelTime += timeSpent
                    }
                    let newObj = new channelUseTime

                    channelTime = convertToHours(channelTime)

                    newObj.channelName = i.name;
                    newObj.channelTime = channelTime;

                    channelsSorted.push(newObj)
                }
                //sorts the channel objects by usetime
                channelsSorted = channelsSorted.sort(function(a, b) {
                    return b.channelTime - a.channelTime
                })
                //converts objects into formatted string for sending
                for (var channel of channelsSorted) {
                    messageArray.push("**" + channel.channelName + "** : " + channel.channelTime + " \r")

                }
                sendEmbed(message.channel.guild.name, message.channel.id, messageArray, userName + "'s activity")
            })
        } else(message.channel.send("sorry I dont see that user"))
        //emojiMenu is still in beta 
    } else if (message.content.startsWith(config.testprefix + "set emojimenu")) {
        let rolesForMenu = []
        let emojiObjects = []
        if (message.member.hasPermission("Manage Roles")) {
            let messageArray = message.content.substring(17)
            messageArray = messageArray.split(", ")
            if (messageArray.length > 6) {
                message.channel.send("sorry, only 6 roles can be set for the menu")
                return
            }

            let myRole = message.guild.roles.find(function(roles) {
                return roles.name === "roletab"
            });
            if (myRole) {
                for (let role of messageArray) {

                    let currentRole = message.guild.roles.find(function(roles) {
                        return roles.name.toUpperCase() === role.toUpperCase()

                    })
                    if (myRole.comparePositionTo(currentRole) > 0) {
                        rolesForMenu.push(currentRole)
                    }
                }
                for (let role of rolesForMenu) {
                    let emojiObject = new emojiRole
                    emojiObject.emoji = emoji[rolesForMenu.indexOf(role)]
                    emojiObject.role = role.id
                    emojiObject.name = role.name
                    emojiObjects.push(emojiObject)
                    console.log(emojiObject)

                }
                guildMap.defer.then(() => {
                    let thisGuild = guildMap.get(message.guild.id)
                    thisGuild.emojiRoles = emojiObjects
                    guildMap.set(message.guild.id, thisGuild)
                    message.channel.send("Use these reactions to give yourself roles!")
                        .then(message => emojiMenu(message))
                        .catch(error => console.log(error))
                })
            } else(message.channel.send("Sorry, role setting is disable on this server"))
        } else(message.channel.send("Sorry, you need the Manage Roles permission for this command"))
    }
})
