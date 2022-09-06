"use strict";

// A word guessing game inspired by Wordle
// Copyright (C) 2022  Asaad Sleman
// 
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// 
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
// 
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

function getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min) ) + min;
}

function get_date() {
    return new Date().toLocaleDateString('he-IL', {timeZone: 'Asia/Jerusalem'});
}

const HEBREW_KEYMAP = {
    'e': 'ק', 'ק': 'ק', 'r': 'ר', 'ר': 'ר', 't': 'א', 'א': 'א', 'y': 'ט', 'ט': 'ט',
    'u': 'ו', 'ו': 'ו', 'i': 'נ', 'ן': 'נ', 'o': 'מ', 'ם': 'מ', 'p': 'פ', 'פ': 'פ',
    'a': 'ש', 'ש': 'ש', 's': 'ד', 'ד': 'ד', 'd': 'ג', 'ג': 'ג', 'f': 'כ', 'כ': 'כ',
    'g': 'ע', 'ע': 'ע', 'h': 'י', 'י': 'י', 'j': 'ח', 'ח': 'ח', 'k': 'ל', 'ל': 'ל',
    'l': 'כ', 'ך': 'כ', ';': 'פ', 'ף': 'פ', 'z': 'ז', 'ז': 'ז', 'x': 'ס', 'ס': 'ס',
    'c': 'ב', 'ב': 'ב', 'v': 'ה', 'ה': 'ה', 'b': 'נ', 'נ': 'נ', 'n': 'מ', 'מ': 'מ',
    'm': 'צ', 'צ': 'צ', ',': 'ת', 'ת': 'ת', '.': 'צ', 'ץ': 'צ'
};
const FINAL_LETTERS = {'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ'};
const FINALED_LETTERS = {'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ'};
const today = get_date();
const word_of_the_day = calculate_meduyeket(today);
let guesses = [];
let lastestResults = getLastestFormattedResults(); 
let hint_attempts = 3;
let letter_states = {};

async function getLastestFormattedResults() {
   const formattedResults = await getFormattedResults(); 
   return formattedResults;
}

function un_finalize(word) {
    return Array.from(word).map(function(letter) {
        if (FINAL_LETTERS.hasOwnProperty(letter))
            return FINAL_LETTERS[letter];
        else
            return letter;
    }).join('');
}

function get_matches(guess, truth) {
    guess = un_finalize(guess);
    truth = un_finalize(truth);

    const not_exact_matches = [];
    for (let i = 0; i < 5; i++)
        if (guess[i] !== truth[i])
            not_exact_matches.push(truth[i]);

    const matches = [];
    for (let i = 0; i < 5; i++) {
        if (guess[i] === truth[i]) {
            matches.push('exact');
            continue;
        }
        const index = not_exact_matches.indexOf(guess[i]);
        if (index === -1) {
            matches.push('wrong');
        } else {
            not_exact_matches.splice(index, 1);
            matches.push('other');
        }
    }
    return matches;
}

function create_result() {
    const RTL_MARK = '\u200f';
    const rows = guesses.map(function(guess) {
        return RTL_MARK + get_matches(guess, word_of_the_day).map(function(match) {
            return {exact: '🟩', other: '🟨', wrong: '⬜'}[match];
        }).join('');
    });
    let score = guesses[guesses.length - 1] === word_of_the_day ? `${guesses.length}/6` : 'X/6';
    if (localStorage.getItem('difficulty') === 'hard')
        score += '*';
    return `מדויקת ${today} - ${score}\n\n` + rows.join('\n');
}

function set_modal_state() {
    switch (history.state) {
        case 'help':
            document.getElementById('modal').classList.remove('hidden');
            document.getElementById('help-screen').classList.remove('hidden');
            document.getElementById('help-screen').scrollTop = 0;
            document.getElementById('settings-screen').classList.add('hidden');
            document.getElementById('success-screen').classList.add('hidden');
            break;

        case 'settings':
            document.getElementById('modal').classList.remove('hidden');
            document.getElementById('help-screen').classList.add('hidden');
            document.getElementById('settings-screen').classList.remove('hidden');
            document.getElementById('success-screen').classList.add('hidden');
            break;

        case 'success':
            document.getElementById('modal').classList.remove('hidden');
            document.getElementById('help-screen').classList.add('hidden');
            document.getElementById('settings-screen').classList.add('hidden');
            document.getElementById('success-screen').classList.remove('hidden');
            fill_success_details();
            countdown();
            break;

        default:
            document.getElementById('modal').classList.add('hidden');
    }
}

function show_help() {
    if (history.state !== 'help') {
        if (history.state === 'settings' || history.state === 'success')
            history.replaceState('help', '');
        else
            history.pushState('help', '');
    }
    set_modal_state();
}

function show_settings() {
    if (history.state !== 'settings') {
        if (history.state === 'help' || history.state === 'success')
            history.replaceState('settings', '');
        else
            history.pushState('settings', '');
    }
    set_modal_state();
}

function show_success_screen() {
    if (history.state !== 'success') {
        if (history.state === 'help' || history.state === 'settings')
            history.replaceState('success', '');
        else
            history.pushState('success', '');
    }
    set_modal_state();
}

function apply_setting(name, value) {
    switch (name) {
        case 'difficulty':
            if (value === 'normal')
                localStorage.setItem('difficulty', 'normal');
            else
                localStorage.setItem('difficulty', 'hard');
            break;

        case 'color-scheme':
            if (value === 'pastel') {
                document.body.classList.remove('colorblind');
                localStorage.setItem('colorblind', 'no');
            } else {
                document.body.classList.add('colorblind');
                localStorage.setItem('colorblind', 'yes');
            }
            break;
    }
}

function copy_result(event) {
    event.stopPropagation();

    window.getSelection().selectAllChildren(document.getElementById('result'));

    const result = create_result() + '\n\nhttps://meduyeket.net';
    navigator.clipboard.writeText(result)
        .then(function() {
            if (navigator.canShare && !navigator.userAgent.includes('Firefox') && !(navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrom') && !navigator.userAgent.includes('Mobile')) && navigator.canShare({text: result})) {
                navigator.share({text: result}).catch(function() {
                    popup('התוצאה הועתקה, אפשר להדביק עם Ctrl+V');
                });
            } else {
                popup('התוצאה הועתקה, אפשר להדביק עם Ctrl+V');
            }
        })
        .catch(function() {
            if (navigator.canShare && !navigator.userAgent.includes('Firefox') && !(navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrom') && !navigator.userAgent.includes('Mobile')) && navigator.canShare({text: result})) {
                navigator.share({text: result}).catch(function() {
                    if (event.target.id !== 'result')
                        popup('לא עבד, נסו להעתיק את הטקסט ידנית');
                });
            } else {
                if (event.target.id !== 'result')
                    popup('לא עבד, נסו להעתיק את הטקסט ידנית');
            }
        });
}

async function fill_success_details() {

    if (localStorage.getItem('finished') === 'yes') {
        document.getElementById('spoiler').classList.remove('hidden');
        document.getElementById('result-container').classList.remove('hidden');

        if (guesses[guesses.length - 1] === word_of_the_day) {
            document.getElementById('success-header').innerText = 'כל הכבוד!';
            document.getElementById('spoiler').classList.add('hidden');
        } else {
            document.getElementById('success-header').innerText = 'לא הצליח הפעם';
            document.getElementById('spoiler').classList.remove('hidden');
            document.getElementById('spoiler-word').innerText = word_of_the_day;
        }

        document.getElementById('result').innerHTML = create_result();
    } else {
        document.getElementById('spoiler').classList.add('hidden');
        document.getElementById('result-container').classList.add('hidden');
    }

    let all_results = await getFormattedResults();
    // TODO: add hint counter to results
    document.getElementById('stats-games').innerText = all_results.length;
    let wins = 0, streak = 0, max_streak = 0;
    let histogram = [0, 0, 0, 0, 0, 0, 0];
    for (const result of all_results) {
        if (result === 'X') {
            streak = 0;
        } else {
            wins++;
            streak++;
            max_streak = Math.max(streak, max_streak);
            histogram[result] += 1;
        }
    }
    document.getElementById('stats-success').innerText = all_results.length > 0 ? Math.round(100 * wins / all_results.length) : 0;
    document.getElementById('stats-streak').innerText = streak;
    document.getElementById('stats-max-streak').innerText = max_streak;

    const hist_max = Math.max(1, Math.max(...histogram));
    const num_guesses = (localStorage.getItem('finished') === 'yes') ? guesses.length : 0;
    for (let i = 1; i <= 6; i++) {
        const elt = document.getElementById(`histogram-${i}`);
        if (i === num_guesses)
            elt.setAttribute('match', 'exact');
        else
            elt.setAttribute('match', 'wrong');
        elt.style.width = `calc(${3 + 77 * histogram[i] / hist_max} * var(--unit))`;
        elt.innerText = histogram[i];
    }
}

function countdown() {
    if (document.getElementById('modal').classList.contains('hidden'))
        return;
    if (document.getElementById('success-screen').classList.contains('hidden'))
        return;

    if (get_date() === today) {
        document.getElementById('countdown').classList.remove('hidden');
        document.getElementById('restart-button').classList.add('hidden');
    } else {
        document.getElementById('countdown-header').innerText = 'המלה הבאה מוכנה';
        document.getElementById('countdown').classList.add('hidden');
        document.getElementById('restart-button').classList.remove('hidden');
        document.getElementById('countdown-container').style.cursor = 'pointer';
        document.getElementById('countdown-container').addEventListener('click', function() {history.replaceState('app', ''); location.reload();});
        return;
    }

    const time_str = new Date().toLocaleTimeString('he-IL', {timeZone: 'Asia/Jerusalem', hourCycle: 'h23'});
    const [hours, minutes, seconds] = time_str.split(':').map(function(x) {return parseInt(x);});
    const since_midnight = 3600 * hours + 60 * minutes + seconds;
    const to_midnight = 3600 * 24 - since_midnight;
    document.getElementById('countdown').innerText =
        `${Math.trunc(to_midnight / 3600)}:${two_digits((to_midnight % 3600) / 60)}:${two_digits(to_midnight % 60)}`;
    window.setTimeout(countdown, 1000 - new Date().getMilliseconds());
}

function two_digits(x) {
    x = Math.trunc(x);
    if (x < 10)
        return '0' + x.toString();
    else
        return x.toString();
}

function hide_modal() {
    if (history.state === 'help' || history.state === 'settings' || history.state === 'success')
        history.replaceState('app', '');
    set_modal_state();
}

function popup(text) {
    document.getElementById('popup').classList.remove('hidden');
    document.getElementById('popup').innerText = text;
    window.setTimeout(function() {
        document.getElementById('popup').classList.add('hidden');
    }, 1500);
}

function type_letter(letter) {
    const row = guesses.length + 1;
    for (let i = 1; i <= 5; i++) {
        const elt = document.getElementById(`letter-${row}-${i}`);
        if (elt.innerText === '') {
            elt.classList.add('typed');
            if (i === 5 && FINALED_LETTERS.hasOwnProperty(letter)) {
                let previous = '';
                for (let j = 1; j <= 4; j++)
                    previous += document.getElementById(`letter-${row}-${j}`).innerText;
                if (WORDS.has(previous + letter))
                    elt.innerText = letter;
                else
                    elt.innerText = FINALED_LETTERS[letter];
            }
            else
                elt.innerText = letter;
            break;
        }
    }
}

function erase_letter() {
    const row = guesses.length + 1;
    for (let i = 5; i >= 1; i--) {
        const elt = document.getElementById(`letter-${row}-${i}`);
        if (elt.innerText !== '') {
            elt.classList.remove('typed');
            elt.innerText = '';
            break;
        }
    }
}

function make_guess() {
    const row = guesses.length + 1;
    let guess = '';
    for (let i = 1; i <= 5; i++) {
        const elt = document.getElementById(`letter-${row}-${i}`);
        guess += elt.innerText;
    }

    let err = null;
    if (guess.length < 5)
        err = 'אין מספיק אותיות';
    else if (!WORDS.has(guess))
        err = 'לא ברשימת המילים';
    else if ((localStorage.getItem('difficulty') === 'hard') && !is_compatible_with_hints(guess))
        err = 'חובה להשתמש בכל הרמזים';

    if (err !== null) {
        const row_elt = document.getElementById(`guess-${row}`);
        row_elt.classList.add('jiggle');
        window.setTimeout(function() {row_elt.classList.remove('jiggle');}, 2000);
        popup(err);
        return;
    }

    const matches = get_matches(guess, word_of_the_day);
    for (let i = 1; i <= 5; i++) {
        const elt = document.getElementById(`letter-${row}-${i}`);
        elt.classList.remove('typed');
        elt.setAttribute('match', matches[i-1]);
    }
    guesses.push(guess);
    localStorage.setItem('guesses', JSON.stringify(guesses));
    if (guess === word_of_the_day) {
        add_result_to_local_storage();
        const row_elt = document.getElementById(`guess-${row}`);
        row_elt.classList.add('win');
        const CONGRATULATIONS = ['גאוני', 'מדהים', 'נפלא', 'סחתיין', 'נהדר', 'מקסים'];
        popup(CONGRATULATIONS[guesses.length - 1]);
        window.setTimeout(show_success_screen, 3600);
    } else {
        window.setTimeout(set_keyboard_key_colors, 100);
        if (guesses.length === 6) {
            add_result_to_local_storage();
            window.setTimeout(show_success_screen, 2000);
        }
    }
}

function count_letters(word) {
    let count = {};
    for (const letter of word) {
        if (!count.hasOwnProperty(letter))
            count[letter] = 0;
        count[letter]++;
    }
    return count;
}

function is_compatible_with_hints(word) {
    const meduyeket = un_finalize(word_of_the_day);
    word = un_finalize(word);

    for (const guess of guesses.map(un_finalize)) {
        const matches = get_matches(guess, meduyeket);
        let letters = {};
        for (let i = 0; i < 5; i++) {
            if (!letters.hasOwnProperty(guess[i]))
                letters[guess[i]] = {required_positions: [], min_count: 0, has_wrong: false, forbidden_positions: []};

            switch (matches[i]) {
                case 'exact':
                    letters[guess[i]].required_positions.push(i);
                    letters[guess[i]].min_count++;
                    break;

                case 'other':
                    letters[guess[i]].min_count++;
                    letters[guess[i]].forbidden_positions.push(i);
                    break;

                case 'wrong':
                    letters[guess[i]].has_wrong = true;
                    break;
            }
        }

        for (const [letter, info] of Object.entries(letters)) {
            let count = 0;
            for (let i = 0; i < 5; i++) {
                if (word[i] === letter) {
                    count++;
                    if (info.forbidden_positions.includes(i))
                        return false;
                } else {
                    if (info.required_positions.includes(i))
                        return false;
                }
            }
            if (count < info.min_count)
                return false;
            if (info.has_wrong && count > info.min_count)
                return false;
        }
    }

    return true;
}

function set_keyboard_key_colors() {
    for (const guess of guesses) {
        if (guess !== word_of_the_day) {
            const matches = get_matches(guess, word_of_the_day);
            for (let i = 0; i < 5; i++) {
                let letter = guess[i];
                if (FINAL_LETTERS.hasOwnProperty(letter))
                    letter = FINAL_LETTERS[letter];

                if (matches[i] === 'exact')
                    letter_states[letter] = 'exact';
                else if (matches[i] === 'other' && letter_states[letter] !== 'exact')
                    letter_states[letter] = 'other';
                else if (matches[i] === 'wrong' && !letter_states.hasOwnProperty(letter))
                    letter_states[letter] = 'wrong';
            }
        }
    }
    for (const elt of document.getElementsByClassName('key'))
        if (letter_states.hasOwnProperty(elt.innerText))
            elt.setAttribute('match', letter_states[elt.innerText]);
}

function handle_key(key) {
    if (localStorage.getItem('finished') === 'yes')
        return;

    else if (key === 'Backspace')
        erase_letter();
    else if (key === 'Enter')
        make_guess();
    else if (HEBREW_KEYMAP.hasOwnProperty(key))
        type_letter(HEBREW_KEYMAP[key]);
}

function handle_on_screen_keyboard_click(event) {
    if (event.currentTarget.classList.contains('wide'))
        handle_key(event.currentTarget.getAttribute('value'));
    else
        handle_key(event.currentTarget.innerText);
}

async function add_result_to_local_storage() {
    let results = await lastestResults;
    results.push(guesses[guesses.length - 1] === word_of_the_day ? guesses.length : 'X');
    postFormattedResults(results);
    localStorage.setItem('finished', 'yes');
}

function load_from_local_storage() {
    const first_time = !localStorage.getItem('date');
    const new_day = localStorage.getItem('date') !== today;
    const is_legacy_game_finished = checkIfLegacyGameFinished();
    const finished_today = (localStorage.getItem('finished') === 'yes') ||  is_legacy_game_finished;

    if (localStorage.getItem('date') !== today)
        localStorage.setItem('date', today);

    if (!localStorage.getItem('guesses'))
        localStorage.setItem('guesses', '[]');
    guesses = JSON.parse(localStorage.getItem('guesses'));

    if (localStorage.getItem('finished') !== 'yes')
        localStorage.setItem('finished', 'no');

    if (!localStorage.getItem('results'))
        localStorage.setItem('results', '[]');

    if (localStorage.getItem('colorblind') === 'yes') {
        document.body.classList.add('colorblind');
        document.querySelector('input[type="radio"][name="color-scheme"][value="high-contrast"]').checked = true;
    } else {
        localStorage.setItem('colorblind', 'no');
        document.body.classList.remove('colorblind');
        document.querySelector('input[type="radio"][name="color-scheme"][value="pastel"]').checked = true;
    }

    if (localStorage.getItem('difficulty') === 'hard') {
        document.querySelector('input[type="radio"][name="difficulty"][value="hard"]').checked = true;
    } else {
        localStorage.setItem('difficulty', 'normal');
        document.querySelector('input[type="radio"][name="difficulty"][value="normal"]').checked = true;
    }

    if (first_time) {
        show_help();
    } else if (new_day) {
        localStorage.setItem('date', today);
        localStorage.setItem('guesses', '[]');
        localStorage.setItem('finished', 'no');
        guesses = [];
        hide_modal();
    } else {
        for (let i = 0; i < guesses.length; i++) {
            const guess = guesses[i];
            const matches = get_matches(guess, word_of_the_day);
            for (let j = 0; j < 5; j++) {
                const elt = document.getElementById(`letter-${i+1}-${j+1}`);
                elt.setAttribute('match', matches[j]);
                elt.innerText = guess[j];
            }
        }
        set_keyboard_key_colors();

        hide_modal();
        if (finished_today)
            window.setTimeout(show_success_screen, 500);
    }
}

let previous_adapt_ts = null;
function adapt_to_window_size() {
    window.requestAnimationFrame(function (ts) {
        if (ts === previous_adapt_ts)
            return;

        const unit = Math.min(0.01 * window.innerWidth, 0.006 * window.innerHeight);
        document.documentElement.style.setProperty('--unit', `${unit}px`);
        previous_adapt_ts = ts;
    });
}

let hint_indices = [];
function show_hint(){
    if(hint_attempts <= 0){
        return;
    }
    let rnd_ind = getRndInteger(0, 5);
    let hint = word_of_the_day[rnd_ind];
    // if hint is shown before, or used
    while (hint_indices.includes(rnd_ind) || letter_states.hasOwnProperty(hint)) {
        rnd_ind = getRndInteger(0, 5);
        hint = word_of_the_day[rnd_ind];
    }
    letter_states[hint] = 'other';
    hint_attempts--;
    for (const elt of document.getElementsByClassName('key'))
        if (letter_states.hasOwnProperty(elt.innerText))
            elt.setAttribute('match', letter_states[elt.innerText]);
}

document.addEventListener('DOMContentLoaded', function () {
    load_from_local_storage();
    document.getElementById('help-button').addEventListener('click', show_help);
    document.getElementById('hint-button').addEventListener('click', show_hint);
    document.getElementById('success-button').addEventListener('click', show_success_screen);
    document.getElementById('settings-button').addEventListener('click', show_settings);
    document.getElementById('share-button').addEventListener('click', copy_result);
    document.getElementById('modal').addEventListener('click', hide_modal);
    document.body.addEventListener('keydown', function(event) {
        if (event.ctrlKey || event.altKey || event.metaKey)
            return;
        if (event.key === '?')
            show_help();
        else if (event.key === 'Escape')
            hide_modal();
        else
            handle_key(event.key);
    });
    for (const elt of document.getElementsByClassName('key'))
        elt.addEventListener('click', handle_on_screen_keyboard_click);
    for (const elt of document.getElementById('settings-screen').querySelectorAll('label'))
        elt.addEventListener('click', function(event) {event.stopPropagation();});
    document.body.addEventListener('change', function(event) {
        apply_setting(event.target.name, event.target.value);
    });
    set_modal_state();
    window.addEventListener('popstate', set_modal_state);
    adapt_to_window_size();
    window.addEventListener('resize', adapt_to_window_size);
});
