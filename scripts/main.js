var stop;   /* queried stop data */
var files;  /* files being uploaded */

const ESCAPE = 27;                              /* keycode of the escape button */
const DEFAULT_ALT = "a picture of a bus stop";  /* default alt text */

/* constants for interaction with the blob store */
const ACC_NAME = 'polarisImages'
const CONTAINER = 'images';
const URI = 'https://' + ACC_NAME + '.blob.core.windows.net';
const SAS = '?sv=2018-03-28&ss=b&srt=sco&sp=rwdlac&se=2019-06-29T03:' +
            '16:47Z&st=2019-05-28T19:16:47Z&spr=https&sig=7fmidcPpGw' + 
            'wNu2CPqV%2B10d9jketDmm7p08BgVYiuMhc%3D';
const BLOB_STORE = AzureStorage.Blob.createBlobServiceWithSas(URI, SAS);
const WEB_SERVICE = 'http://40.118.214.163:8080/stops/';

/* sets everything up once we have the stop data */
function setup(data) {
    stop = data;
    $('title').html(stop.name);
    $('.title h2').html(stop.name);
    $('.title p').html(
        'Stop # ' + stop.id.substring(2) + ' - ' + stop.direction + ' bound'
    );
    $('#score h1').html(stop.score);
    $('#score p').html('(' + stop.ratings + ' ratings)');
    $('#access-text').html(
        '<i>accessible to ' + stop.yesAccessible + ' users, inaccessible to ' 
                            + stop.noAccessible + ' users</i>'
    );

    /* reformat the data for use later */
    stop.tags.sort(function(a, b) { return b.count - a.count; });
    stop.images.sort(function(a, b) {
        let d1 = Date.parse(a.dateUploaded);
        let d2 = Date.parse(b.dateUploaded);

        if (d1 > d2) return -1;
        else if (d2 > d1) return 1;
        else return 0;
    });

    /* for keeping track of uploading files */
    files = [];

    /* Puts the initial tags on the page */
    for (let i = 0; i < stop.tags.length; i++) {
        $('.tag-container').append(getTag(i));
    }

    /* Puts the initial images on the page */
    if (stop.images.length == 0) {
        $('.image-container').append(
            '<div class="empty">no images to show for this stop</div>'
        );
    } else {
        for (let i = 0; i < stop.images.length; i++) {
            $('.image-container').append(getCard(stop.images[i]));
        }
    }

    /* Behavior for clicking on a tag */
    $(".tag").click(function() {
        $('#save-button').text('Save');
        let i = $(this).attr('id').charAt(4);
        if (!$(this).attr('class').includes('tag-selected')) {
            stop.tags[i].count = stop.tags[i].count + 1;
            $(this).attr('class', 'tag tag-selected');
            $(this).html(format(stop.tags[i].label, stop.tags[i].count));
        } else {
            stop.tags[i].count = stop.tags[i].count - 1;
            $(this).attr('class', getClass(i));
            $(this).html(format(stop.tags[i].label, stop.tags[i].count));
        }
    });

    /* Save by updating count and color in the tag */
    $('#save-button').click(function() {
        $(this).text('Saving...');

        put(stop,
            function(res) {
                $('#save-button').text('Saved!');
            },
            function(err) {
                console.log(err);
            }
        );
    });

    /* Opens the modal to upload an image */
    $('#upload-button').click(function() {
        $('#upload-modal').show();
        $('input[type="file"]').focus();

    });

    /* Zoom in when an image is clicked */
    $('.card').click(function() {
        $('#img-modal').show();
        $('#img-modal img').attr('src', $(this).find('img').attr('src'));
    });

    /* Close the modal */
    $('.close').click(function() {
        resetModal();
        $('.modal').hide();
    });

    /* Close any modal when escape is pressed */
    $(document).keyup(function(e) {
        if (e.keyCode == ESCAPE) {
            resetModal();
            $('.modal').hide();
        }
    });

    $('#yes').click(function() {
        $('#no').attr('disabled', true);
        $('#yes').html('Saving...');
        stop.yesAccessible++;
        put(stop,
            function(res) {
                $('#yes').html('Saved!');

            },
            function(err) {
                console.log(err);
            }
        );
    });

    $('#no').click(function() {
        $('#yes').attr('disabled', true);
        $('#no').html('Saving...');
        stop.noAccessible++;
        put(stop,
            function(res) {
                $('#no').html('Saved!');

            },
            function(err) {
                console.log(err);
            }
        );
    });

    /* Close the modal when 'Cancel' is clicked */
    $('#cancel').click(function() {
        resetModal();
        $('.modal').hide();
    });

    /* Upload images to server and update the page */
    $('#ok').click(function() {
        BLOB_STORE.createBlockBlobFromBrowserFile('images',
            files[0].name,
            files[0],
            (error, result) => {
                if(!error) {
                    let date = new Date();
                    let newImage = {
                        'imageUrl': URI + "/" + CONTAINER + "/" + 
                                    files[0].name + SAS,
                        'altText': $('textarea').val(),
                        'dateUploaded': date.getMonth() + 1 + '/' +
                        date.getDate() + '/' +
                        date.getFullYear()
                    };
                    stop.images.push(newImage);
                    $('.image-container').prepend(getCard(newImage));

                    $('.empty').remove();  /* remove default empty text */

                    // do the binding again since we added some cards
                    $('.card').click(function() {
                        $('#img-modal').show();
                        $('#img-modal img').attr('src',
                            $(this).find('img').attr('src')
                        );
                    });

                    put(stop,
                        function(res) {
                            resetModal();
                            $('.modal').hide();
                        },
                        function(err) {
                            console.log(err);
                        }
                    );

                } else {
                    console.log(error);
                }
            });
    });

    $('#img-modal').click(function() {
        resetModal();
        $('.modal').hide();
    });

    /* Locally save uploaded files and enable the 'Ok' button */
    $('input[type="file"]').change(function(e) {
        files = e.target.files;

        if (files.length > 0) {
            $('#ok').attr('disabled', false);
            $('#ok').attr('title', '');
        } else {
            $('#ok').attr('disabled', true);
            $('#ok').attr('title', 'please select an image before uploading');
        }
    });
}

/*
 * Returns a String in the format "name (count)"
 */
function format(name, count) {
    return name + ' (' + count + ')';
}

/*
 * Returns the class of the tag with the given index based on counts
 */
function getClass(i) {
    return (stop.tags[i].count == 0) ? 'tag' : 'tag tag-default';
}

/*
 * Resets the upload image modal
 */
function resetModal() {
    $('textarea').val('');
    $('#ok').attr('disabled', true);
    $('#ok').attr('title', 'please select an image before uploading');
    $('input[type="file"]').val('');
    files = null;
}

/*
 * Returns the query parameter with the given name or false if there
 * is no such query parameter included
 */
function getQueryParam(name) {
    let results = new RegExp('[\?&]' + name + '=([^&#]*)')
        .exec(window.location.search);
    return (results !== null) ? results[1] || 0 : false;
}

/* Returns the tag HTML for the given index in the data */
function getTag(i) {
    return (
        '<button type="button" id="btn-' + i + '" class="' + getClass(i) + '">' +
            format(stop.tags[i].label, stop.tags[i].count) +
        '</button>'
    );
}

/* Returns the image HTML for the given image and alt text */
function getCard(image) {
    let alt = image.altText;
    if (alt.length == 0) {
        alt = DEFAULT_ALT;
    }

    return (
        '<div class="card">' +
        '<img src="' + image.imageUrl + '" alt="' + alt + '">' +
        '<div>date uploaded: ' + image.dateUploaded + '</div>' +
        '</div>'
    );
}

/* 
 * PUTs the given stop, taking the desired success and
 * error functions to be called accordingly
 */
function put(stop, success, error) {
    $.ajax({
        type: 'PUT',
        url: WEB_SERVICE + stop.id,
        data: JSON.stringify(stop),
        dataType: 'json',
        contentType: 'application/json',
        success: success,
        error: error
    });
}

/* make a GET request and then load the page */
$(document).ready(function() {
    console.log(WEB_SERVICE + getQueryParam('id'));
    $.ajax({
        type: 'GET',
        url: WEB_SERVICE + getQueryParam('id'),
        contentType: 'text/json',
        success: function (data) {
            $('#loading').hide();
            console.log(JSON.stringify(data));
            setup(data);
        },
        error: function (err) {
            $('.lds-dual-ring').remove();
            $('#loading').append(
                '<div class="error">A ' + err.status + ' error occurred. ' + err.responseText + '</div>'
            );
            console.log(err);
        }
    });
});
