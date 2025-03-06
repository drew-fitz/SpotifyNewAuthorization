from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import openai
import spotipy


app = Flask(__name__)
CORS(app) #enables resource sharing with javascript


SPOTIFY_USER_INFO_URL = "https://api.spotify.com/v1/me"


@app.route('/')
def home():
    return "Welcome to the Spotify Genie Flask API! Try visiting /api/protected for the Spotify genie endpoint"


SPOTIFY_API_URL = "https://api.spotify.com/v1/me/tracks"




@app.route('/api/save-token', methods=['POST'])
def save_token():
    """Endpoint to receive and store the access token"""
    global spotify_access_token
    data = request.get_json()


    if 'accessToken' not in data:
        return jsonify({"error": "Access token is missing"}), 400


    spotify_access_token = data['accessToken']
    print("Access token ", spotify_access_token)
    return jsonify({"message": "Access token received and saved successfully"})




@app.route('/api/user-songs', methods=['GET'])
def get_user_songs():
    """Endpoint to fetch user's saved songs from Spotify"""
    if not spotify_access_token:
        return jsonify({"error": "No access token available"}), 401


    headers = {
        'Authorization': f'Bearer {spotify_access_token}',
    }


    try:
        response = requests.get(SPOTIFY_API_URL, headers=headers)
       
        # Check if the response from Spotify is successful
        if response.status_code != 200:
            return jsonify({"error": "Failed to fetch songs from Spotify", "details": response.json()}), 500


        return jsonify(response.json())


    except requests.exceptions.RequestException as e:
        return jsonify({"error": "An error occurred while fetching songs", "details": str(e)}), 500




if __name__ == '__main__':
    app.run(debug=True)



