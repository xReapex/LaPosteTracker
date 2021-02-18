// ascii
var AsciiTable = require("ascii-table")

// request
const request = require("request");

// discord bot client
const Discord = require("discord.js");
const bot = new Discord.Client();
const config = require("./config.json");

//lowdb
const low = require("lowdb")
const FileSync = require("lowdb/adapters/FileSync");
const adapter = new FileSync("db.json");
const db = low(adapter);

db.defaults({ users: [], guilds: [] }).write();

// colors
const vert = "#32CD32";
const orange = "#FFA500";
const rouge = "#B22222";

// request options
const options = {
    url: "",
    headers: {
        "X-Okapi-Key": config["X-Okapi-Key"],
        "Accept": "application/json",
    }
};

bot.on("ready", () => {
    bot.user.setActivity("LaPoste.net", { type: "WATCHING" });
});

bot.on("message", async (msg) => {

    // support guild
    if (msg.channel.id !== "810234057241133057" && msg.guild.id === "810227718011748373"){return}

    // guild options
    const prefix = db.get("guilds").find({ id: msg.guild.id }).get("config[0]['prefix']").value();
    const autodelete = db.get("guilds").find({ id: msg.guild.id }).get("config[0]['autodeleteMessage']").value();

    // return if bot
    if (msg.author.bot){return;}

    // register user
    if (!db.get("users").find({ id: msg.author.id }).value()) {
        db.get("users").push({ id: msg.author.id }).write();
        db.get("users").find({ id: msg.author.id }).set("numero", []).write();
    }

    //register guild
    if (!db.get("guilds").find({ id: msg.guild.id }).value()) {
        db.get("guilds").push({ id: msg.guild.id }).write();
        db.get("guilds").find({ id: msg.guild.id }).set("config", []).write();
        db.get("guilds").find({ id: msg.guild.id }).get("config").push({ prefix: "p.", autodeleteMessage: "false" }).write();

        const embed = new Discord.MessageEmbed()
                .setColor(vert)
                .setTitle("Le serveur a correctement été initialisé ! Démarrez avec \"p.help\" .")

            msg.channel.send(embed);
    }

    // define args
    let args = msg.content.split(" ");

    // add colis
    if (msg.content.startsWith(prefix + "add")) {
        if(autodelete === "true"){msg.delete()}

        // check args
        const embed = new Discord.MessageEmbed()
            .setColor(rouge)
            .setTitle("Merci de saisir un numéro de suivi.")

        if (!args[1]) { return msg.channel.send(embed); }

        // check if colis exists
        if (db.get("users").find({ id: msg.author.id }).get("numero").find({ colis: args[1].toUpperCase() }).value()) {
            const embed = new Discord.MessageEmbed()
                .setColor(orange)
                .setTitle("Ce numéro de colis existe déjà.")

            msg.channel.send(embed);
        }
        else {
            const embed = new Discord.MessageEmbed()
                .setColor(vert)
                .setTitle("Colis correctement ajouté.")

            msg.channel.send(embed);
            // push colis number
            db.get("users").find({ id: msg.author.id }).get("numero").push({ colis: args[1].toUpperCase() }).write();
        }
    }

    if (msg.content.startsWith(prefix + "remove")) {
        if(autodelete === "true"){msg.delete();}
        if (!args[1]) {
            const embed = new Discord.MessageEmbed()
                .setColor(rouge)
                .setTitle("Merci de choisir un colis à supprimer.")

            return msg.channel.send(embed);
        }
        else {
            if (db.get("users").find({ id: msg.author.id }).get("numero").find({ colis: args[1].toUpperCase() }).value()) {
                db.get("users").find({ id: msg.author.id }).get("numero").remove({ colis: args[1].toUpperCase() }).write();

                const embed = new Discord.MessageEmbed()
                    .setColor(vert)
                    .setTitle("Le colis n°" + args[1].toUpperCase() + " a bien été supprimé.")
                return msg.channel.send(embed);
            }
            else {
                const embed = new Discord.MessageEmbed()
                    .setColor(orange)
                    .setTitle("Le colis n°" + args[1].toUpperCase() + " est introuvable.")
                return msg.channel.send(embed);
            }
        }
    }

    if (msg.content.startsWith(prefix + "status")) {
        if(autodelete === "true"){msg.delete()}

        // check colis
        allColis = db.get("users").find({ id: msg.author.id }).get("numero").map("colis").value();

        // check if colis null
        if (allColis.length === 0) {
            const embed = new Discord.MessageEmbed()
                .setColor(orange)
                .setTitle("Pas de colis enregistré.")

            return msg.channel.send(embed);
        }

        // create table
        const table = new AsciiTable("Colis suivis de " + msg.author.username);
        table.setHeading("N°", "Status", "Code")

        // request callback process
        async function callback(error, response, body) {

            if (!error && response.statusCode == 200) {
                const info = JSON.parse(body);

                statusTextLength = info["shipment"]["timeline"].length;
                statusText = info["shipment"]["timeline"][statusTextLength - 1]['shortLabel'];

                await table.addRow(info["shipment"]["idShip"], statusText, info['returnCode']);

            } else {
                const info = JSON.parse(body);
                await table.addRow(info["idShip"], "/", info["returnCode"]);
            }
        }

        allColis.forEach(element => {
            options.url = `https://api.laposte.fr/suivi/v2/idships/${element}?lang=fr_FR`;
            request(options, callback);
        });

        await new Promise(r => setTimeout(r, allColis.length * 300));
        msg.channel.send("```\n" + table.toString() + "```")
    }

    // codes
    if (msg.content === prefix + "codes") {
        if(autodelete === "true"){msg.delete()}

        // create table
        const table = new AsciiTable("Correspondance des codes");

        // set head
        table
            .setHeading('Code', 'Description')
            .addRow("200", "Ressource correcte")
            .addRow("207", "Réponse à statut multiple")
            .addRow("400", "Numéro invalide")
            .addRow("401", "Non-autorisé")
            .addRow("404", "Ressource non trouvée")
            .addRow("500", "Erreur système")
            .addRow("504", "Service indisponible")

        return msg.channel.send("```\n" + table.toString() + "```")
    }

    // config
    if (msg.content.startsWith(prefix + "config")) {
        if (!msg.member.hasPermission('ADMINISTRATOR')) {return;}
        if(autodelete === "true"){msg.delete()}
        if (!args[1] || !args[2]) {
            const embed = new Discord.MessageEmbed()
                .setColor(rouge)
                .setTitle(`Format invalide => ${prefix}config <set|remove> <key|all> <value>`)
            return msg.channel.send(embed)
        }
        else {

            if (args[1] === "set" || args[1] === "remove") {

                // set
                if (args[1] === "set") {
                    if (args[2] === "prefix" || args[2] === "autodelete") {

                        // set prefix
                        if (args[2] === "prefix") {

                            // value
                            if (!args[3]) {
                                const embed = new Discord.MessageEmbed()
                                    .setColor(orange)
                                    .setTitle('Format invalide, valeur manquante.')
                                return msg.channel.send(embed)
                            }
                            else {
                                if (args[3].length === 1 || args[3].length === 2) {
                                    db.get('guilds').find({ id: msg.guild.id }).get('config[0]').assign({ prefix: args[3] }).write();
                                    const embed = new Discord.MessageEmbed()
                                        .setColor(vert)
                                        .setTitle(`Le prefix est désormais "${args[3]}" .`)
                                    return msg.channel.send(embed)
                                } else {
                                    const embed = new Discord.MessageEmbed()
                                        .setColor(orange)
                                        .setTitle('La taille du prefix doit être de 1 ou 2 caractères.')
                                    return msg.channel.send(embed)
                                }
                            }
                        }

                        // set autodeleteMessage
                        if (args[2] === "autodelete") {

                            // value
                            if (!args[3]) {
                                const embed = new Discord.MessageEmbed()
                                    .setColor(orange)
                                    .setTitle('Format invalide, valeur manquante.')
                                return msg.channel.send(embed)
                            }
                            else {
                                if (args[3] === "true" || args[3] === "false") {
                                    db.get('guilds').find({ id: msg.guild.id }).get('config[0]').assign({ autodeleteMessage: args[3] }).write();
                                    const embed = new Discord.MessageEmbed()
                                        .setColor(vert)
                                        .setTitle(`La suppression des messages automatique est désormais "${args[3]}" .`)
                                    return msg.channel.send(embed)
                                } else {
                                    const embed = new Discord.MessageEmbed()
                                        .setColor(orange)
                                        .setTitle('La valeur doit être soit "true" soit "false" .')
                                    return msg.channel.send(embed)
                                }
                            }
                        }
                    } else {
                        const embed = new Discord.MessageEmbed()
                            .setColor(orange)
                            .setTitle('Format invalide, le deuxième paramètre est incorrect ("prefix" | "autodelete").')
                        return msg.channel.send(embed)
                    }
                }
                else {
                    if (args[2] === "all") {
                        // set defaults
                        db.get('guilds').find({ id: msg.guild.id }).get('config[0]').assign({ prefix: "p." }).write();
                        db.get('guilds').find({ id: msg.guild.id }).get('config[0]').assign({ autodeleteMessage: "false" }).write();

                        const embed = new Discord.MessageEmbed()
                            .setColor(vert)
                            .setTitle(`Les valeurs de base ont bien été appliquées.`)
                        return msg.channel.send(embed)
                    }
                    else {
                        const embed = new Discord.MessageEmbed()
                            .setColor(orange)
                            .setTitle(`Format invalide, la commande exacte est ${prefix}config remove all.`)
                        return msg.channel.send(embed)
                    }
                }
            }
            else {
                const embed = new Discord.MessageEmbed()
                    .setColor(rouge)
                    .setTitle('Le premier argument doit être "set" ou "remove" .')

                return msg.channel.send(embed)
            }
        }
    }

    // invite
    if (msg.content === prefix + "invite")
    {
        if(autodelete === "true"){msg.delete()}

        // create table invite
        const tableInvite = new AsciiTable("Invitations concernant le bot");

        // set head
        tableInvite.setHeading('Destination', 'URL', 'Permissions')

        // set rows
        tableInvite
            .addRow(`Lien d'invitation du bot`, 'bit.ly/3qf4QKG', '11264')
            .addRow(`Lien d'invitation du support`, 'bit.ly/2ZgNIIA', '/')

        msg.channel.send("```\n" + tableInvite.toString() + "```")
    }

    // help
    if (msg.content === prefix + "help") {
        if(autodelete === "true"){msg.delete()}
        
        // create table help
        const table = new AsciiTable("Détail des commandes");

        // set head
        table.setHeading('Commande', 'Description', 'Admin')

        // set rows
        table
            .addRow(`${prefix}help`, 'Affiche toutes les commandes du bot', 'Non')
            .addRow(`${prefix}invite`, 'Affiche les invitations du bot', 'Non')
            .addRow(`${prefix}add <colis>`, 'Enregistre un nouveau colis', 'Non')
            .addRow(`${prefix}remove <colis>`, 'Supprime un colis', 'Non')
            .addRow(`${prefix}status`, 'Affiche le status de vos colis', 'Non')
            .addRow(`${prefix}codes`, "Affiche la correspondance des codes", 'Non')
            .addRow(`${prefix}config set`, `Change la valeur de la clef`, 'Oui')
            .addRow(`${prefix}config remove`, 'Met les valeurs par défaut', 'Oui')

        msg.channel.send("```\n" + table.toString() + "```")

    }
});

bot.login(config.token);
