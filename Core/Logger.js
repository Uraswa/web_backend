
class Logger {

    error(text, module = 'common') {
        console.error(text);
    }

    log(text, module = 'common'){
        console.log(text);
    }

}

export default new Logger();