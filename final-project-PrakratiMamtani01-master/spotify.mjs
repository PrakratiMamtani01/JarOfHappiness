import mongoose from 'mongoose';

const Item = mongoose.model('Item');

const moods = ['mood', 'party', 'pop', 'workout', 'focus', 'travel', 'edm']

export function populate() {
    getToken().then(response => {
        moods.forEach((mood) => {
            getMoodPlaylist(response.access_token, mood).then(playlist => {
                getPlaylistTracks(response.access_token, playlist.id, mood)
                console.log('Songs successfully imported to database.');
            })
        })
    });
}

async function getToken() {
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        body: new URLSearchParams({
            'grant_type': 'client_credentials',
        }),
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + (Buffer.from(process.env.client_id + ':' + process.env.client_secret).toString('base64')),
        },
    });

    return await response.json();
}

async function getMoodPlaylist(access_token, mood) {
    const query = encodeURIComponent(`tag:${mood}`);
    const url = `https://api.spotify.com/v1/search?q=${query}&type=playlist`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
        });

        const data = await response.json();
        // console.log(data.playlists.items[0])
        return data.playlists?.items[0] || [];
    } catch (error) {
        console.error(`Error searching playlists for mood "${mood}":`, error.message);
        return [];
    }
}


async function getPlaylistTracks(access_token, playlistId, mood) {
    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${access_token}`,
        },
    });


    const data = await response.json();

    for (const item of data.items.slice(0, 5)) {
        const newSong = new Item({
            itemId: Math.floor(Math.random() * 100000), // Random ID
            mood: mood, // Assign the mood passed to the function
            category: 'song', // Category as song
            content: item.track.name, // Song name
            author: item.track.artists[0]?.name || "Unknown Artist", // Artist name
            owner: 'public'
        });

        try {
            await newSong.save(); // Save to database
        } catch (error) {
            console.error(`Error saving song "${item.track.name}":`, error.message);
        }
    }
}